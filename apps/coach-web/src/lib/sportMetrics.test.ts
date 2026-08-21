import { timeToSec, avgSpeed, swimPace100, swimMeters } from './sportMetrics'

test('timeToSec parses M:SS and H:MM:SS, rejects garbage', () => {
  expect(timeToSec('46:48')).toBe(2808)
  expect(timeToSec('1:25:14')).toBe(5114)
  expect(timeToSec('nope')).toBeNull()
  expect(timeToSec(null)).toBeNull()
})

test('avgSpeed derives mph and km/h from dist + time', () => {
  expect(avgSpeed(15.3, '52:00', 'mi')).toBe('17.7 mph')
  expect(avgSpeed(15.3, '52:00', 'km')).toBe('28.4 km/h')
  expect(avgSpeed(0, '52:00', 'mi')).toBeNull()
  expect(avgSpeed(15.3, null, 'mi')).toBeNull()
})

test('swimPace100 gives pace per 100 m', () => {
  // 1500 m in 26:15 (1575 s) -> 105 s per 100 m -> 1:45
  expect(swimPace100(1500 / 1609.344, '26:15')).toBe('1:45 /100m')
  expect(swimPace100(null, '26:15')).toBeNull()
})

test('swimMeters renders stored miles as meters', () => {
  expect(swimMeters(1500 / 1609.344)).toBe('1,500 m')
  expect(swimMeters(0.93)).toBe('1,497 m')
  expect(swimMeters(null)).toBe('')
})
