// Dependency-free XLSX writer. An .xlsx file is a ZIP of OOXML parts; we write
// stored (uncompressed) entries with correct CRC32 so Excel, Numbers, LibreOffice
// and Google Sheets all open the result. Values are inline strings so no shared
// string table is required.

export interface Sheet {
  name: string
  rows: Array<Array<string | number | null | undefined>>
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let value = i
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    table[i] = value >>> 0
  }
  return table
})()

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function utf8(value: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(value)
}

function u16(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff]
}

function u32(value: number): number[] {
  return [value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]
}

export function zipStore(entries: Array<{ name: string; data: Uint8Array }>): Uint8Array<ArrayBuffer> {
  const locals: number[] = []
  const central: number[] = []
  let offset = 0
  for (const entry of entries) {
    const name = utf8(entry.name)
    const crc = crc32(entry.data)
    const local = [
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(entry.data.length),
      ...u32(entry.data.length),
      ...u16(name.length),
      ...u16(0),
      ...name,
    ]
    locals.push(...local, ...entry.data)
    central.push(
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(entry.data.length),
      ...u32(entry.data.length),
      ...u16(name.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
      ...name,
    )
    offset += local.length + entry.data.length
  }
  const end = [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(central.length),
    ...u32(offset),
    ...u16(0),
  ]
  return new Uint8Array([...locals, ...central, ...end])
}

function xml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function columnName(index: number): string {
  let value = index + 1
  let name = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    name = String.fromCharCode(65 + remainder) + name
    value = Math.floor((value - 1) / 26)
  }
  return name
}

function sheetName(name: string, used: Set<string>, index: number): string {
  let clean = name.replace(/[\\/*?:[\]]/g, ' ').trim().slice(0, 31) || `Sheet ${index + 1}`
  let suffix = 2
  while (used.has(clean.toLowerCase())) {
    clean = `${clean.slice(0, 28)} ${suffix}`
    suffix += 1
  }
  used.add(clean.toLowerCase())
  return clean
}

function sheetXml(rows: Sheet['rows']): string {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const reference = `${columnName(columnIndex)}${rowIndex + 1}`
          if (value === null || value === undefined || value === '') return ''
          if (typeof value === 'number' && Number.isFinite(value)) {
            return `<c r="${reference}"><v>${value}</v></c>`
          }
          return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${xml(String(value))}</t></is></c>`
        })
        .join('')
      return `<row r="${rowIndex + 1}">${cells}</row>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`
}

export function buildXlsx(input: Sheet[]): Uint8Array<ArrayBuffer> {
  const sheets = input.length ? input : [{ name: 'Sheet 1', rows: [] }]
  const used = new Set<string>()
  const named = sheets.map((sheet, index) => ({ name: sheetName(sheet.name, used, index), rows: sheet.rows }))
  const entries: Array<{ name: string; data: Uint8Array }> = []

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${named
    .map(
      (_sheet, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')}</Types>`

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`

  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${named
    .map((sheet, index) => `<sheet name="${xml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join('')}</sheets></workbook>`

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${named
    .map(
      (_sheet, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
    )
    .join('')}</Relationships>`

  entries.push({ name: '[Content_Types].xml', data: utf8(contentTypes) })
  entries.push({ name: '_rels/.rels', data: utf8(rootRels) })
  entries.push({ name: 'xl/workbook.xml', data: utf8(workbook) })
  entries.push({ name: 'xl/_rels/workbook.xml.rels', data: utf8(workbookRels) })
  named.forEach((sheet, index) => {
    entries.push({ name: `xl/worksheets/sheet${index + 1}.xml`, data: utf8(sheetXml(sheet.rows)) })
  })
  return zipStore(entries)
}

export function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  const escape = (value: unknown) => {
    const text = value === null || value === undefined ? '' : String(value)
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return `${rows.map((row) => row.map(escape).join(',')).join('\r\n')}\r\n`
}

// Converts a table into rows with numeric cells where the value is a clean
// number. Currency symbols and thousands separators are accepted, but a value
// containing letters stays text so nothing is silently coerced.
export function numeric(value: string): number | null {
  const clean = value.replace(/[,\s]/g, '').replace(/^(ETB|USD|EUR|\$|€|£)/i, '')
  if (!/^-?\d+(\.\d+)?%?$/.test(clean)) return null
  if (clean.endsWith('%')) return Number(clean.slice(0, -1)) / 100
  return Number(clean)
}
