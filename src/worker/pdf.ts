// Dependency-free PDF report writer for Workers. Produces a real PDF 1.4 file
// with Helvetica text, tables, totals and page numbers. Text outside WinAnsi
// (for example Ge'ez script) is shown as "?" in the PDF; the XLSX export keeps
// the exact Unicode text, and the report notes the limitation.

export interface PdfTable {
  title?: string
  columns: string[]
  rows: string[][]
  totals?: string[]
}

export interface PdfOptions {
  company: string
  title: string
  subtitle?: string
  date?: string
  summary?: string
  fields?: Array<{ label: string; value: string }>
  tables?: PdfTable[]
  uncertain?: string[]
  footer?: string
}

const PAGE_W = 595
const PAGE_H = 842
const MARGIN = 50
const CONTENT_W = PAGE_W - MARGIN * 2
const ACCENT: [number, number, number] = [1, 0.48, 0.27]
const INK: [number, number, number] = [0.13, 0.14, 0.16]
const MUTED: [number, number, number] = [0.42, 0.44, 0.48]

function latin1(value: string): string {
  return [...value]
    .map((char) => {
      const code = char.charCodeAt(0)
      if (code <= 255) return char
      const replacements: Record<string, string> = {
        '\u2018': "'",
        '\u2019': "'",
        '\u201c': '"',
        '\u201d': '"',
        '\u2013': '-',
        '\u2014': '-',
        '\u2026': '...',
        '\u20ac': 'EUR',
        '\u00a0': ' ',
      }
      return replacements[char] ?? '?'
    })
    .join('')
}

function pdfString(value: string): string {
  return latin1(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]+/g, ' ')
}

function num(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

function charWidth(char: string, bold: boolean): number {
  if (/[iljI.,:;'!|]/.test(char)) return 0.26
  if (/[mwMW@]/.test(char)) return 0.86
  if (/[A-Z]/.test(char)) return bold ? 0.66 : 0.63
  if (/[0-9]/.test(char)) return 0.56
  if (char === ' ') return 0.28
  return bold ? 0.55 : 0.52
}

function textWidth(value: string, size: number, bold = false): number {
  let width = 0
  for (const char of value) width += charWidth(char, bold) * size
  return width
}

function wrap(value: string, maxWidth: number, size: number, bold = false): string[] {
  const words = latin1(value).split(/\s+/).filter(Boolean)
  if (!words.length) return ['']
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (textWidth(candidate, size, bold) <= maxWidth || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
    // Break a single very long token so it cannot run off the page.
    while (textWidth(current, size, bold) > maxWidth && current.length > 1) {
      let cut = current.length - 1
      while (cut > 1 && textWidth(current.slice(0, cut), size, bold) > maxWidth) cut -= 1
      lines.push(current.slice(0, cut))
      current = current.slice(cut)
    }
  }
  if (current) lines.push(current)
  return lines
}

class Page {
  content: string[] = []
  y = PAGE_H - MARGIN

  text(value: string, x: number, y: number, size: number, bold: boolean, color: [number, number, number] = INK) {
    this.content.push(
      `BT ${color.map(num).join(' ')} rg /${bold ? 'F2' : 'F1'} ${num(size)} Tf 1 0 0 1 ${num(x)} ${num(y)} Tm (${pdfString(value)}) Tj ET`,
    )
  }

  rect(x: number, y: number, width: number, height: number, color: [number, number, number], stroke = false) {
    this.content.push(`${color.map(num).join(' ')} rg ${num(x)} ${num(y)} ${num(width)} ${num(height)} re ${stroke ? 'S' : 'f'}`)
  }

  line(x1: number, y1: number, x2: number, y2: number, color: [number, number, number] = [0.85, 0.86, 0.88], width = 0.5) {
    this.content.push(`${num(width)} w ${color.map(num).join(' ')} RG ${num(x1)} ${num(y1)} m ${num(x2)} ${num(y2)} l S`)
  }
}

export function buildPdf(options: PdfOptions): Uint8Array<ArrayBuffer> {
  const pages: Page[] = [new Page()]
  let page = pages[0]
  const date = options.date ?? new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })

  const newPage = () => {
    page = new Page()
    pages.push(page)
    return page
  }

  const ensure = (height: number) => {
    if (page.y - height < MARGIN + 30) newPage()
  }

  // Header band
  page.rect(0, PAGE_H - 10, PAGE_W, 10, ACCENT)
  page.text(options.company.toUpperCase(), MARGIN, PAGE_H - MARGIN, 9, true, ACCENT)
  page.y = PAGE_H - MARGIN - 30
  page.text(options.title, MARGIN, page.y, 21, true)
  page.y -= 18
  if (options.subtitle) {
    for (const line of wrap(options.subtitle, CONTENT_W, 10)) {
      page.text(line, MARGIN, page.y, 10, false, MUTED)
      page.y -= 13
    }
  }
  page.text(date, MARGIN, page.y, 9, false, MUTED)
  page.y -= 12
  page.line(MARGIN, page.y, PAGE_W - MARGIN, page.y, ACCENT, 1)
  page.y -= 24

  if (options.fields?.length) {
    for (const field of options.fields) {
      ensure(22)
      const label = `${field.label}:`
      page.text(label, MARGIN, page.y, 9.5, true, MUTED)
      const lines = wrap(field.value, CONTENT_W - 150, 10)
      let offset = 0
      for (const line of lines) {
        page.text(line, MARGIN + 150, page.y - offset, 10, false)
        offset += 13
      }
      page.y -= Math.max(16, offset + 3)
    }
    page.y -= 6
  }

  if (options.summary) {
    ensure(40)
    page.text('Summary', MARGIN, page.y, 12, true)
    page.y -= 16
    for (const line of wrap(options.summary, CONTENT_W, 10)) {
      ensure(16)
      page.text(line, MARGIN, page.y, 10, false)
      page.y -= 13.5
    }
    page.y -= 10
  }

  for (const table of options.tables ?? []) {
    if (!table.columns.length) continue
    ensure(60)
    if (table.title) {
      page.text(table.title, MARGIN, page.y, 11.5, true)
      page.y -= 17
    }
    const columns = table.columns.slice(0, 8)
    const rows = table.rows.map((row) => row.slice(0, columns.length).map((cell) => String(cell ?? '')))
    const weights = columns.map((column, index) => {
      const sample = [column, ...rows.slice(0, 40).map((row) => row[index] ?? '')]
      return Math.max(8, Math.min(38, Math.max(...sample.map((value) => value.length)) + 2))
    })
    const totalWeight = weights.reduce((sum, weight) => sum + weight, 0)
    const widths = weights.map((weight) => (weight / totalWeight) * CONTENT_W)
    const size = columns.length > 6 ? 7.5 : 8.5

    const drawHeader = () => {
      const height = 20
      page.rect(MARGIN, page.y - height + 5, CONTENT_W, height, ACCENT)
      let x = MARGIN + 4
      columns.forEach((column, index) => {
        const lines = wrap(column, widths[index] - 8, size, true).slice(0, 1)
        page.text(lines[0] ?? '', x, page.y - 9, size, true, [1, 1, 1])
        x += widths[index]
      })
      page.y -= height
    }
    drawHeader()

    let stripe = false
    for (const row of rows) {
      const cellLines = row.map((cell, index) => wrap(cell, widths[index] - 8, size))
      const height = Math.max(...cellLines.map((lines) => lines.length)) * (size + 2.5) + 5
      if (page.y - height < MARGIN + 30) {
        newPage()
        page.text(`${table.title ?? 'Table'} (continued)`, MARGIN, page.y, 9, true, MUTED)
        page.y -= 14
        drawHeader()
      }
      if (stripe) page.rect(MARGIN, page.y - height + 4, CONTENT_W, height, [0.965, 0.968, 0.972])
      let x = MARGIN + 4
      cellLines.forEach((lines, index) => {
        lines.forEach((line, lineIndex) => page.text(line, x, page.y - 8 - lineIndex * (size + 2.5), size, false))
        x += widths[index]
      })
      page.y -= height
      page.line(MARGIN, page.y + 3, PAGE_W - MARGIN, page.y + 3, [0.88, 0.89, 0.91], 0.4)
      stripe = !stripe
    }

    if (table.totals?.length) {
      ensure(24)
      page.rect(MARGIN, page.y - 19, CONTENT_W, 20, [0.95, 0.95, 0.96])
      page.text(table.totals.join('   ·   '), MARGIN + 4, page.y - 7, size + 0.5, true)
      page.y -= 24
    }
    page.y -= 14
  }

  if (options.uncertain?.length) {
    ensure(50)
    page.text('Needs review', MARGIN, page.y, 11.5, true, [0.65, 0.35, 0.1])
    page.y -= 16
    for (const item of options.uncertain) {
      for (const line of wrap(`- ${item}`, CONTENT_W, 9.5)) {
        ensure(14)
        page.text(line, MARGIN, page.y, 9.5, false)
        page.y -= 12.5
      }
    }
  }

  const total = pages.length
  pages.forEach((item, index) => {
    item.line(MARGIN, MARGIN + 14, PAGE_W - MARGIN, MARGIN + 14, [0.88, 0.89, 0.91], 0.5)
    item.text(options.footer ?? 'Generated by Lumo', MARGIN, MARGIN, 8, false, MUTED)
    item.text(`Page ${index + 1} of ${total}`, PAGE_W - MARGIN - 58, MARGIN, 8, false, MUTED)
  })

  const objects: string[] = []
  const pageObjectStart = 5
  const kids = pages.map((_item, index) => `${pageObjectStart + index * 2} 0 R`).join(' ')
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  pages.forEach((item, index) => {
    const pageNumber = pageObjectStart + index * 2
    const contentNumber = pageNumber + 1
    const stream = item.content.join('\n')
    objects[pageNumber] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNumber} 0 R >>`
    objects[contentNumber] = `<< /Length ${latin1(stream).length} >>\nstream\n${stream}\nendstream`
  })
  const infoNumber = pageObjectStart + pages.length * 2
  objects[infoNumber] = `<< /Title (${pdfString(options.title)}) /Author (${pdfString(options.company)}) /Producer (Lumo) /CreationDate (D:${new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)}) >>`

  const encoder = new TextEncoder()
  const bytes: number[] = []
  const push = (value: string) => {
    for (const byte of encoder.encode(value)) bytes.push(byte)
  }
  const offsets: number[] = []
  push('%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n')
  for (let index = 1; index < objects.length; index += 1) {
    if (!objects[index]) continue
    offsets[index] = bytes.length
    push(`${index} 0 obj\n${objects[index]}\nendobj\n`)
  }
  const xrefOffset = bytes.length
  const count = infoNumber + 1
  push(`xref\n0 ${count}\n0000000000 65535 f \n`)
  for (let index = 1; index < count; index += 1) {
    const offset = offsets[index] ?? 0
    push(`${String(offset).padStart(10, '0')} 00000 n \n`)
  }
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info ${infoNumber} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`)
  return new Uint8Array(bytes)
}
