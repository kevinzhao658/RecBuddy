import { workoutMetricLine } from './workoutMetric'

const w = (over: object) =>
  ({ type: 'easy', dist: 4, pace: '9:30/mi', est_minutes: null, dur: null, ...over }) as any

test('distance workouts read dist · pace', () => {
  expect(workoutMetricLine(w({}), 'mi')).toBe('4 mi · 9:30/mi')
})

test("'other' reads TOTAL TIME even when a legacy phantom dist/pace lingers", () => {
  expect(workoutMetricLine(w({ type: 'other', est_minutes: 40 }), 'mi')).toBe('40m')
  expect(workoutMetricLine(w({ type: 'other', est_minutes: null, dist: null, pace: null }), 'mi')).toBeNull()
})

test('cross reads total time (est default when unset)', () => {
  expect(workoutMetricLine(w({ type: 'cross', dist: null, pace: null, est_minutes: 65 }), 'mi')).toBe('1h 5m')
  expect(workoutMetricLine(w({ type: 'cross', dist: null, pace: null }), 'mi')).toBe('45m') // estMinutes cross fallback
})
