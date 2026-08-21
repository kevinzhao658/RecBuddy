import { fromMiles, type Unit } from './units'

const M_PER_MI = 1609.344

/** 'M:SS' or 'H:MM:SS' -> total seconds; null if unparseable. */
export function timeToSec(time: string | null): number | null {
  if (!time) return null
  const p = time.split(':').map(Number)
  if (p.some(isNaN)) return null
  const secs = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2]
    : p.length === 2 ? p[0] * 60 + p[1] : NaN
  return isNaN(secs) || secs <= 0 ? null : secs
}

/** Ride lens: average speed, e.g. "17.7 mph" / "28.5 km/h". */
export function avgSpeed(distMiles: number | null, time: string | null, unit: Unit): string | null {
  const secs = timeToSec(time)
  if (distMiles == null || distMiles <= 0 || secs == null) return null
  const v = fromMiles(distMiles, unit) / (secs / 3600)
  return `${v.toFixed(1)} ${unit === 'km' ? 'km/h' : 'mph'}`
}

/** Swim lens: pace per 100 m, e.g. "1:45 /100m" — THE swim metric. */
export function swimPace100(distMiles: number | null, time: string | null): string | null {
  const secs = timeToSec(time)
  if (distMiles == null || distMiles <= 0 || secs == null) return null
  const per100 = Math.round(secs / ((distMiles * M_PER_MI) / 100))
  return `${Math.floor(per100 / 60)}:${String(per100 % 60).padStart(2, '0')} /100m`
}

/** Swim distances read in meters ("1,500 m"), never miles. */
export function swimMeters(distMiles: number | null): string {
  if (distMiles == null) return ''
  return `${Math.round(distMiles * M_PER_MI).toLocaleString('en-US')} m`
}
