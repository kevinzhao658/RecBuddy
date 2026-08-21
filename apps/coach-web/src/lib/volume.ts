import type { Workout, Actual } from './types'
import { estMinutes } from './estMinutes'

/** Which sport a volume gauge is showing. */
export type VolumeMode = 'run' | 'cross'

export interface VolumeSide { planned: number; done: number }
/** Per-sport split of the cross side's DONE miles — drives the color-coded
 *  segments in the cross volume bar. 'run' is a run the athlete declared on a
 *  cross day; unlogged done cross workouts default to ride (the log default). */
export interface CrossDoneBySport { run: number; ride: number; swim: number }
export interface PeriodVolume {
  run: VolumeSide; cross: VolumeSide; hasCross: boolean
  crossDone: CrossDoneBySport
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

/** Declared sport of a logged actual: the explicit activity column when set,
 *  else the legacy pace inference (pace == null -> ride). */
export function actualActivity(a: Actual): 'run' | 'ride' | 'swim' {
  if (a.activity === 'run' || a.activity === 'ride' || a.activity === 'swim') return a.activity
  return a.pace == null ? 'ride' : 'run'
}

/** Run vs cross volume for a set of workouts. Attached results bucket by the
 *  WORKOUT'S type ('cross' -> cross, else run) — whatever gets recorded
 *  against a cross workout (bike, swim, even a run) counts toward cross
 *  totals, never run. Extras bucket by declared activity ('run' -> run;
 *  'ride'/'swim' -> cross; legacy null -> pace inference). Time on feet stays
 *  combined: logged elapsed when present, estMinutes fallback. Mirrors the
 *  athlete app's PlanStore split exactly. */
export function volumeSplit(workouts: Workout[], actuals: Record<string, Actual>, extras: Actual[]): PeriodVolume {
  const run: VolumeSide = { planned: 0, done: 0 }
  const cross: VolumeSide = { planned: 0, done: 0 }
  const crossDone: CrossDoneBySport = { run: 0, ride: 0, swim: 0 }
  let plannedMin = 0, doneMin = 0
  for (const w of workouts) {
    if (w.type !== 'rest') (w.type === 'cross' ? cross : run).planned += w.dist ?? 0
    plannedMin += estMinutes(w)
    if (w.status !== 'done') continue
    const a = actuals[w.id]
    if (a) {
      const dist = a.dist ?? 0
      ;(w.type === 'cross' ? cross : run).done += dist
      if (w.type === 'cross') crossDone[actualActivity(a)] += dist
      doneMin += elapsedToMin(a.time) ?? estMinutes(w)
    } else {
      ;(w.type === 'cross' ? cross : run).done += w.dist ?? 0
      if (w.type === 'cross') crossDone.ride += w.dist ?? 0
      doneMin += estMinutes(w)
    }
  }
  for (const a of extras) {
    const sport = actualActivity(a)
    ;(sport === 'run' ? run : cross).done += a.dist ?? 0
    if (sport !== 'run') crossDone[sport] += a.dist ?? 0
    doneMin += elapsedToMin(a.time) ?? 0
  }
  return { run, cross, hasCross: cross.planned > 0 || cross.done > 0, crossDone, plannedMin, doneMin }
}
