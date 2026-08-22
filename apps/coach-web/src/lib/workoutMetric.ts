import type { Workout } from './types'
import { estMinutes } from './estMinutes'
import { fmtDist, fmtPace, type Unit } from './units'
import { fmtDur } from './fmtDur'

/** The one-line metric a prescription card shows. Time-based types (cross,
 *  other) read as TOTAL TIME — even when a legacy row still carries a phantom
 *  dist/pace from before the editor hid those fields. Distance types read as
 *  dist · pace. Null = show nothing. */
export function workoutMetricLine(w: Workout, unit: Unit): string | null {
  if (w.type === 'cross' || w.type === 'other') {
    const mins = estMinutes(w)
    return mins > 0 ? fmtDur(mins) : null
  }
  if (w.dist != null) return `${fmtDist(w.dist, unit)} ${unit} · ${fmtPace(w.pace, unit)}`
  return null
}
