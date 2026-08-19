import type { Workout, Actual } from './types'
import { estMinutes } from './estMinutes'

/** Which sport a volume gauge is showing. */
export type VolumeMode = 'run' | 'ride'

export interface VolumeSide { planned: number; done: number }
export interface PeriodVolume {
  run: VolumeSide; ride: VolumeSide; hasRide: boolean
  plannedMin: number; doneMin: number
}

/** '46:48' or '1:25:14' -> whole minutes (rounded); null if unparseable. */
export function elapsedToMin(time: string | null): number | null {
  if (!time) return null
  const p = time.split(':').map(Number)
  if (p.some(isNaN)) return null
  const secs = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2]
    : p.length === 2 ? p[0] * 60 + p[1] : NaN
  return isNaN(secs) ? null : Math.round(secs / 60)
}

/** Run vs ride volume for a set of workouts, counting LOGGED actuals for done
 *  workouts (kind: pace == null -> ride) with planned-dist fallback bucketed
 *  by type ('cross' -> ride); extras bucket by the same pace rule. Time on
 *  feet stays combined: logged elapsed when present, estMinutes fallback.
 *  Mirrors the athlete app's PlanStore split exactly. */
export function volumeSplit(workouts: Workout[], actuals: Record<string, Actual>, extras: Actual[]): PeriodVolume {
  const run: VolumeSide = { planned: 0, done: 0 }
  const ride: VolumeSide = { planned: 0, done: 0 }
  let plannedMin = 0, doneMin = 0
  for (const w of workouts) {
    if (w.type !== 'rest') (w.type === 'cross' ? ride : run).planned += w.dist ?? 0
    plannedMin += estMinutes(w)
    if (w.status !== 'done') continue
    const a = actuals[w.id]
    if (a) {
      ;(a.pace == null ? ride : run).done += a.dist ?? 0
      doneMin += elapsedToMin(a.time) ?? estMinutes(w)
    } else {
      ;(w.type === 'cross' ? ride : run).done += w.dist ?? 0
      doneMin += estMinutes(w)
    }
  }
  for (const a of extras) {
    ;(a.pace == null ? ride : run).done += a.dist ?? 0
    doneMin += elapsedToMin(a.time) ?? 0
  }
  return { run, ride, hasRide: ride.planned > 0 || ride.done > 0, plannedMin, doneMin }
}
