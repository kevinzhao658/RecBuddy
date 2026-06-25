import { fromMiles, toMiles, fmtDist, fmtPace } from './units'

test('miles is the identity unit', () => {
  expect(fromMiles(6, 'mi')).toBe(6)
  expect(toMiles(6, 'mi')).toBe(6)
  expect(fmtDist(6, 'mi')).toBe('6')
  expect(fmtDist(4.5, 'mi')).toBe('4.5')
  expect(fmtPace('8:30/mi', 'mi')).toBe('8:30/mi')
})

test('km conversion for distance and pace', () => {
  expect(fmtDist(10, 'km')).toBe('16.1') // 10 * 1.609344
  expect(fmtPace('8:30/mi', 'km')).toBe('5:17/km') // 510s/mi -> ~317s/km
  expect(Math.round(toMiles(16.1, 'km'))).toBe(10)
})

test('null/empty inputs format to empty', () => {
  expect(fmtDist(null, 'km')).toBe('')
  expect(fmtPace(null, 'km')).toBe('')
})
