import type { Workout } from './types'

export function paceToSec(pace: string | null): number {
  if (!pace) return 0
  const [m, s] = pace.split('/')[0].split(':').map(Number)
  return (m || 0) * 60 + (s || 0)
}
export function estMinutes(w: Pick<Workout, 'type' | 'est_minutes' | 'dist' | 'pace' | 'dur'>): number {
  if (!w || w.type === 'rest') return 0
  if (w.est_minutes != null) return w.est_minutes
  if (w.dist && w.pace) return Math.round((w.dist * paceToSec(w.pace)) / 60)
  if (w.dur) return w.dur
  if (w.type === 'cross') return 45
  return 0
}
