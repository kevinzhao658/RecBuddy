import type { Workout } from './types'

export function paceToSec(pace: string | null): number {
  if (!pace) return 0
  const [m, s] = pace.split('/')[0].split(':').map(Number)
  return (m || 0) * 60 + (s || 0)
}
/** Seconds-per-mile → canonical pace string, e.g. 570 → '9:30/mi'. */
export function secToPace(secPerMile: number): string {
  const s = Math.max(0, Math.round(secPerMile))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}/mi`
}
export function estMinutes(w: Pick<Workout, 'type' | 'est_minutes' | 'dist' | 'pace' | 'dur'>): number {
  if (!w || w.type === 'rest') return 0
  if (w.est_minutes != null) return w.est_minutes
  if (w.dist && w.pace) return Math.round((w.dist * paceToSec(w.pace)) / 60)
  if (w.dur) return w.dur
  if (w.type === 'cross') return 45
  return 0
}
