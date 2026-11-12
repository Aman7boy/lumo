// Knowledge pipeline: pull plain text out of an uploaded file, chunk it, and
// retrieve the passages most relevant to a question. The chunk table is the
// pgvector stand-in for this build: lexical ranking now, embeddings later.

export interface RetrievedChunk {
  docId: string
  title: string
  content: string
  score: number
}

export function chunkText(text: string, size = 900, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  if (!clean) return []
  if (clean.length <= size) return [clean]

  const chunks: string[] = []
  let start = 0
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length)
    if (end < clean.length) {
      const boundary = clean.lastIndexOf('\n\n', end)
      const sentence = clean.lastIndexOf('. ', end)
      if (boundary > start + size * 0.55) end = boundary
      else if (sentence > start + size * 0.55) end = sentence + 1
    }
    const piece = clean.slice(start, end).trim()
    if (piece) chunks.push(piece)
    if (end >= clean.length) break
    start = Math.max(end - overlap, start + 1)
  }
  return chunks
}

const STOPWORDS = new Set(
  'the and for you your with that this what when where which how from are was were will would can could should our its it is of to in on at as be by or an a do does did not have has had i we they he she them me my us'.split(
    ' ',
  ),
)

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9\u00c0-\u024f]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
}

export function rankChunks(
  question: string,
  chunks: Array<{ docId: string; title: string; content: string }>,
  limit = 4,
): RetrievedChunk[] {
  const terms = [...new Set(tokenize(question))]
  if (!chunks.length) return []
  if (!terms.length) {
    return chunks.slice(0, Math.min(limit, 2)).map((c) => ({ ...c, score: 0 }))
  }
  const scored = chunks.map((chunk) => {
    const haystack = `${chunk.title}\n${chunk.content}`.toLowerCase()
    let score = 0
    for (const term of terms) {
      const matches = haystack.split(term).length - 1
      if (matches > 0) score += 1 + Math.log(matches)
      if (chunk.title.toLowerCase().includes(term)) score += 2.5
    }
    if (/\b(price|quotation|quote|policy|supplier|product|catalogue)\b/i.test(question)) {
      if (/\d/.test(chunk.content)) score += 0.4
    }
    return { ...chunk, score: score / Math.sqrt(1 + chunk.content.length / 400) }
  })
  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// File text extraction
// ---------------------------------------------------------------------------

export interface ExtractedDocument {
  text: string
  note?: string
}

const MAX_TEXT = 300_000

export async function extractDocument(file: File): Promise<ExtractedDocument> {
  const name = file.name.toLowerCase()
  const bytes = new Uint8Array(await file.arrayBuffer())

  if (/\.(txt|md|markdown|csv|tsv|json|log|yaml|yml|html?|xml)$/.test(name) || file.type.startsWith('text/')) {
    const text = new TextDecoder().decode(bytes)
    return { text: name.endsWith('.html') || name.endsWith('.htm') ? stripHtml(text) : text }
  }

  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const text = await pdfToText(bytes)
    return { text, note: 'PDF text layer extracted. Scanned pages need OCR.' }
  }

  if (name.endsWith('.docx')) {
    const xml = await readZipEntry(bytes, 'word/document.xml')
    if (!xml) throw new Error('This .docx has no readable document.xml.')
    return { text: stripXml(xml.replace(/<\/w:p>/g, '\n').replace(/<w:tab\/>/g, '\t')).slice(0, MAX_TEXT) }
  }

  if (name.endsWith('.xlsx')) {
    const shared = await readZipEntry(bytes, 'xl/sharedStrings.xml')
    const sheet = (await readZipEntry(bytes, 'xl/worksheets/sheet1.xml')) ?? (await readZipEntry(bytes, 'xl/worksheets/Sheet1.xml'))
    if (!sheet) throw new Error('No first worksheet found in this workbook.')
    const strings = shared
      ? [...shared.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => stripXml(m[1]))
      : []
    const rows = [...sheet.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)].map((row) => {
      const cells = [...row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)].map(([, attrs, body]) => {
        const value = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? /<t[^>]*>([\s\S]*?)<\/t>/.exec(body)?.[1] ?? ''
        if (/t="s"/.test(attrs)) return strings[Number(value)] ?? ''
        return stripXml(value)
      })
      return cells.join('\t')
    })
    return { text: rows.filter(Boolean).join('\n').slice(0, MAX_TEXT) }
  }

  if (name.endsWith('.zip') || name.endsWith('.xls') || name.endsWith('.doc')) {
    throw new Error('Legacy Office files are not supported. Save as .docx, .xlsx or PDF and upload again.')
  }

  // Unknown type: accept it as text if it decodes to something readable.
  const guess = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  const printable = guess.replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\uffff]/g, '')
  if (printable.length > guess.length * 0.85 && printable.length > 40) return { text: printable }
  throw new Error('Unsupported file type. Upload PDF, DOCX, XLSX, CSV, TXT or Markdown.')
}

// Fetch a public web page for knowledge ingestion. Blocks loopback, private
// ranges, link-local addresses and non-HTTP schemes so a tenant cannot use the
// Worker as an internal network proxy.
export async function extractUrlText(rawUrl: string): Promise<{ title: string; text: string }> {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Enter a full web address starting with http:// or https://.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Only http and https URLs can be ingested.')
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === '0.0.0.0' ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^\[?::1\]?$/.test(host)
  ) {
    throw new Error('That address points to a private or local network and cannot be ingested.')
  }

  const response = await fetch(url.toString(), {
    headers: { 'User-Agent': 'LumoKnowledgeBot/1.0 (+https://lumo.et)' },
    signal: AbortSignal.timeout(15_000),
    redirect: 'follow',
  })
  if (!response.ok) throw new Error(`The page returned HTTP ${response.status}.`)
  const contentType = response.headers.get('content-type') ?? ''
  if (!/text\/|application\/(json|xml)|application\/xhtml/.test(contentType)) {
    throw new Error('Only text-based pages can be ingested.')
  }
  const raw = await response.text()
  if (raw.length > 2_500_000) throw new Error('That page is larger than 2.5 MB and was not ingested.')
  const titleMatch = /<title[^>]*>([\s\S]{0,200}?)<\/title>/i.exec(raw)?.[1]
  const text = stripHtml(raw).slice(0, MAX_TEXT)
  if (text.length < 60) throw new Error('No readable text was found on that page.')
  return { title: (titleMatch ? decodeEntities(titleMatch).replace(/\s+/g, ' ').trim() : url.hostname).slice(0, 120), text }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|tr)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&')
}

function stripXml(xml: string): string {
  return decodeEntities(xml.replace(/<[^>]+>/g, '')).replace(/[ \t]{2,}/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// PDF text layer
// ---------------------------------------------------------------------------

async function pdfToText(bytes: Uint8Array): Promise<string> {
  const latin = latin1(bytes)
  const pieces: string[] = []
  const streamRe = /stream\r?\n([\s\S]*?)endstream/g
  let match: RegExpExecArray | null
  while ((match = streamRe.exec(latin))) {
    const header = latin.slice(Math.max(0, match.index - 300), match.index)
    const raw = match[1]
    let content: string | null = null
    if (/FlateDecode/.test(header)) {
      try {
        const inflated = await inflate(new Uint8Array([...raw].map((ch) => ch.charCodeAt(0) & 0xff)), 'deflate')
        content = latin1(inflated)
      } catch {
        content = null
      }
    } else if (!/\/Image|\/DCTDecode|\/JPXDecode/.test(header)) {
      content = raw
    }
    if (!content || !/(Tj|TJ)/.test(content)) continue
    pieces.push(pdfContentToText(content))
  }

  const text = pieces
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (text.length < 30) {
    throw new Error('No text layer found in this PDF. It may be a scan; paste the text into the knowledge base instead.')
  }
  return text.slice(0, MAX_TEXT)
}

function pdfContentToText(content: string): string {
  const out: string[] = []
  // Arrays used by TJ: [(Hello) -20 (world)] TJ
  const tokenRe = /\((?:\\.|[^\\()])*\)|<[0-9A-Fa-f\s]+>|\bT[dDm*]\b|\bET\b|\bTJ\b|\bTj\b/g
  let current = ''
  let match: RegExpExecArray | null
  while ((match = tokenRe.exec(content))) {
    const token = match[0]
    if (token.startsWith('(')) {
      current += decodePdfString(token.slice(1, -1))
    } else if (token.startsWith('<')) {
      const hex = token.slice(1, -1).replace(/\s+/g, '')
      if (hex.length % 4 === 0 && hex.length > 0) {
        let decoded = ''
        for (let i = 0; i < hex.length; i += 4) decoded += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16))
        current += decoded
      } else if (hex.length % 2 === 0 && hex.length > 0) {
        for (let i = 0; i < hex.length; i += 2) current += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16))
      }
    } else if (token === 'Td' || token === 'TD' || token === 'T*') {
      current += ' '
    } else if (token === 'ET') {
      current += '\n'
    } else if (token === 'TJ' || token === 'Tj') {
      out.push(current)
      current = ''
    }
  }
  if (current.trim()) out.push(current)
  return out.join(' ').replace(/\s+([,.;:!?])/g, '$1')
}

function decodePdfString(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, ' ')
    .replace(/\\t/g, ' ')
    .replace(/\\([()\\])/g, '$1')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\\n/g, '')
}

// ---------------------------------------------------------------------------
// Minimal ZIP reader (DOCX and XLSX are ZIP containers)
// ---------------------------------------------------------------------------

function readU16(bytes: Uint8Array, offset: number): number {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readU32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}

export async function readZipEntry(bytes: Uint8Array, target: string): Promise<string | null> {
  let eocd = -1
  const floor = Math.max(0, bytes.length - 66_000)
  for (let i = bytes.length - 22; i >= floor; i -= 1) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      eocd = i
      break
    }
  }
  if (eocd < 0) return null

  const entries = readU16(bytes, eocd + 10)
  let offset = readU32(bytes, eocd + 16)
  const decoder = new TextDecoder()

  for (let i = 0; i < entries; i += 1) {
    if (readU32(bytes, offset) !== 0x02014b50) break
    const method = readU16(bytes, offset + 10)
    const compressedSize = readU32(bytes, offset + 20)
    const nameLength = readU16(bytes, offset + 28)
    const extraLength = readU16(bytes, offset + 30)
    const commentLength = readU16(bytes, offset + 32)
    const localOffset = readU32(bytes, offset + 42)
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    offset += 46 + nameLength + extraLength + commentLength

    if (name !== target) continue
    if (readU32(bytes, localOffset) !== 0x04034b50) return null
    const localNameLength = readU16(bytes, localOffset + 26)
    const localExtraLength = readU16(bytes, localOffset + 28)
    const start = localOffset + 30 + localNameLength + localExtraLength
    const data = bytes.subarray(start, start + compressedSize)
    if (method === 0) return decoder.decode(data)
    if (method === 8) {
      try {
        return decoder.decode(await inflate(data, 'deflate-raw'))
      } catch {
        return null
      }
    }
    return null
  }
  return null
}

async function inflate(data: Uint8Array, format: 'deflate' | 'deflate-raw'): Promise<Uint8Array> {
  const copy = new Uint8Array(data)
  const stream = new Blob([copy]).stream().pipeThrough(new DecompressionStream(format))
  const buffer = await new Response(stream).arrayBuffer()
  return new Uint8Array(buffer)
}

function latin1(bytes: Uint8Array): string {
  let out = ''
  const step = 8192
  for (let i = 0; i < bytes.length; i += step) {
    out += String.fromCharCode(...bytes.subarray(i, i + step))
  }
  return out
}
