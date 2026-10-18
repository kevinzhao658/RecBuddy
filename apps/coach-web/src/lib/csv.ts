// Minimal RFC 4180 CSV: quoted fields, embedded commas/quotes/newlines, CRLF.

/** Cells starting with these are formulas in Excel/Sheets. Report content is
 *  user-written, so prefix them with ' to keep a crafted message from running
 *  as a formula on the admin's machine (CSV/formula injection). */
const FORMULA_START = /^[=+\-@\t\r]/

export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value)
  if (FORMULA_START.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** Parse CSV text into rows of cells. Tolerates a BOM, LF or CRLF, and a
 *  trailing newline. Drops fully-empty lines. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else cell += c
      continue
    }
    if (c === '"' && cell === '') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((v) => v !== '')) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((v) => v !== '')) rows.push(row)
  return rows
}

/** Trigger a browser download of text content. */
export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
  // BOM so Excel opens UTF-8 (names with accents, emoji) correctly.
  const blob = new Blob(['\uFEFF', text], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
