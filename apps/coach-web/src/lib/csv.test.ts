import { csvCell, parseCsv, toCsv } from './csv'

test('round-trips commas, quotes, and newlines', () => {
  const rows = [['a', 'b,c', 'say "hi"', 'line1\nline2', '']]
  expect(parseCsv(toCsv(rows))).toEqual(rows)
})

test('neutralizes spreadsheet formulas in user content', () => {
  expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
  expect(csvCell('+1')).toBe("'+1")
  expect(csvCell('-2')).toBe("'-2")
  expect(csvCell('@SUM')).toBe("'@SUM")
  expect(csvCell('plain')).toBe('plain')
})

test('parses BOM, CRLF, trailing newline, and skips blank lines', () => {
  expect(parseCsv('\uFEFFa,b\r\n1,2\r\n\r\n3,4\n')).toEqual([['a', 'b'], ['1', '2'], ['3', '4']])
})
