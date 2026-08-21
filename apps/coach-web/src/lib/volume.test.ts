import { volumeSplit, elapsedToMin, actualActivity } from './volume'

const w = (id: string, type: string, dist: number | null, status = 'planned') =>
  ({ id, type, dist, status, pace: '9:00/mi', est_minutes: null, dur: null, sets: [] }) as any
const act = (workout_id: string, dist: number, pace: string | null, time: string, activity: string | null = null) =>
  ({ id: 'a' + workout_id, workout_id, dist, pace, time, activity }) as any
const extra = (dist: number, pace: string | null, time: string, activity: string | null = null) =>
  ({ id: 'x' + dist, workout_id: null, dist, pace, time, activity }) as any

test('elapsedToMin parses M:SS and H:MM:SS, rejects garbage', () => {
  expect(elapsedToMin('46:48')).toBe(47)
  expect(elapsedToMin('1:25:14')).toBe(85)
  expect(elapsedToMin('nope')).toBeNull()
  expect(elapsedToMin(null)).toBeNull()
})

test('actualActivity: explicit column wins, legacy falls back to pace rule', () => {
  expect(actualActivity(extra(5, '9:00/mi', '45:00', 'swim'))).toBe('swim')
  expect(actualActivity(extra(5, null, '45:00', 'run'))).toBe('run')
  expect(actualActivity(extra(5, '9:00/mi', '45:00'))).toBe('run')
  expect(actualActivity(extra(5, null, '45:00'))).toBe('ride')
})

test('done run counts its LOGGED distance, not the plan', () => {
  const v = volumeSplit([w('w1', 'easy', 8, 'done')], { w1: act('w1', 6.2, '9:10/mi', '56:50') }, [])
  expect(v.run.done).toBeCloseTo(6.2)
  expect(v.run.planned).toBe(8)
  expect(v.hasCross).toBe(false)
})

test('done workout without a log falls back to planned dist, bucketed by type', () => {
  const v = volumeSplit([w('w1', 'easy', 5, 'done'), w('w2', 'cross', 10, 'done')], {}, [])
  expect(v.run.done).toBe(5)
  expect(v.cross.done).toBe(10)
})

test('anything logged against a cross workout lands on the cross side — even with a run pace', () => {
  const v = volumeSplit(
    [w('w1', 'cross', null, 'done'), w('w2', 'cross', null, 'done')],
    { w1: act('w1', 15.3, null, '52:00', 'ride'), w2: act('w2', 3, '10:00/mi', '30:00', 'run') }, [])
  expect(v.cross.done).toBeCloseTo(18.3)
  expect(v.run.done).toBe(0)
  expect(v.hasCross).toBe(true)
})

test('extras bucket by declared activity: run -> run, ride/swim -> cross', () => {
  const v = volumeSplit([w('w1', 'rest', null)], {},
    [extra(5, '9:00/mi', '45:00', 'run'), extra(12, null, '40:00', 'ride'), extra(1, null, '35:00', 'swim')])
  expect(v.run.done).toBe(5)
  expect(v.cross.done).toBe(13)
  expect(v.run.planned).toBe(0)
})

test('crossDone splits the cross side by declared sport; unlogged done cross defaults to ride', () => {
  const v = volumeSplit(
    [w('w1', 'cross', null, 'done'), w('w2', 'cross', 4, 'done')],
    { w1: act('w1', 1.2, null, '35:00', 'swim') },  // declared swim on a cross day
    [extra(10, null, '40:00', 'ride')])              // w2 done without a log -> ride bucket
  expect(v.cross.done).toBeCloseTo(15.2)
  expect(v.crossDone.swim).toBeCloseTo(1.2)
  expect(v.crossDone.ride).toBeCloseTo(14)
  expect(v.crossDone.run).toBe(0)
})

test('legacy extras (null activity) fall back to the pace rule', () => {
  const v = volumeSplit([], {}, [extra(5, '9:00/mi', '45:00'), extra(12, null, '40:00')])
  expect(v.run.done).toBe(5)
  expect(v.cross.done).toBe(12)
})

test('time on feet: logged elapsed when present, estMinutes fallback, extras add', () => {
  // w1 done+logged 56:50 (57m), w2 planned 5mi@9:00 (45m est), extra run 45:00.
  const v = volumeSplit([w('w1', 'easy', 8, 'done'), w('w2', 'easy', 5)],
    { w1: act('w1', 6.2, '9:10/mi', '56:50') }, [extra(5, '9:00/mi', '45:00')])
  expect(v.doneMin).toBe(57 + 45)
  expect(v.plannedMin).toBe(72 + 45) // est(8mi@9:00)=72 + est(5mi@9:00)=45
})
