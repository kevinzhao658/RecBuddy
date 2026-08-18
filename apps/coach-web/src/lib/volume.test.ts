import { volumeSplit, elapsedToMin } from './volume'

const w = (id: string, type: string, dist: number | null, status = 'planned') =>
  ({ id, type, dist, status, pace: '9:00/mi', est_minutes: null, dur: null, sets: [] }) as any
const act = (workout_id: string, dist: number, pace: string | null, time: string) =>
  ({ id: 'a' + workout_id, workout_id, dist, pace, time }) as any
const extra = (dist: number, pace: string | null, time: string) =>
  ({ id: 'x' + dist, workout_id: null, dist, pace, time }) as any

test('elapsedToMin parses M:SS and H:MM:SS, rejects garbage', () => {
  expect(elapsedToMin('46:48')).toBe(47)
  expect(elapsedToMin('1:25:14')).toBe(85)
  expect(elapsedToMin('nope')).toBeNull()
  expect(elapsedToMin(null)).toBeNull()
})

test('done run counts its LOGGED distance, not the plan', () => {
  const v = volumeSplit([w('w1', 'easy', 8, 'done')], { w1: act('w1', 6.2, '9:10/mi', '56:50') }, [])
  expect(v.run.done).toBeCloseTo(6.2)
  expect(v.run.planned).toBe(8)
  expect(v.hasRide).toBe(false)
})

test('done workout without a log falls back to planned dist, bucketed by type', () => {
  const v = volumeSplit([w('w1', 'easy', 5, 'done'), w('w2', 'cross', 10, 'done')], {}, [])
  expect(v.run.done).toBe(5)
  expect(v.ride.done).toBe(10)
})

test('ride actual (null pace) on a cross day lands on the ride side', () => {
  const v = volumeSplit([w('w1', 'cross', null, 'done')], { w1: act('w1', 15.3, null, '52:00') }, [])
  expect(v.ride.done).toBeCloseTo(15.3)
  expect(v.run.done).toBe(0)
  expect(v.hasRide).toBe(true)
})

test('extras bucket by the pace rule; rest is excluded from planned', () => {
  const v = volumeSplit([w('w1', 'rest', null)], {}, [extra(5, '9:00/mi', '45:00'), extra(12, null, '40:00')])
  expect(v.run.done).toBe(5)
  expect(v.ride.done).toBe(12)
  expect(v.run.planned).toBe(0)
})

test('time on feet: logged elapsed when present, estMinutes fallback, extras add', () => {
  // w1 done+logged 56:50 (57m), w2 planned 5mi@9:00 (45m est), extra run 45:00.
  const v = volumeSplit([w('w1', 'easy', 8, 'done'), w('w2', 'easy', 5)],
    { w1: act('w1', 6.2, '9:10/mi', '56:50') }, [extra(5, '9:00/mi', '45:00')])
  expect(v.doneMin).toBe(57 + 45)
  expect(v.plannedMin).toBe(72 + 45) // est(8mi@9:00)=72 + est(5mi@9:00)=45
})
