export type Unit = 'mi' | 'km'
const KM_PER_MI = 1.609344

/** Stored miles → display value in the chosen unit. */
export function fromMiles(miles: number, unit: Unit): number {
  return unit === 'km' ? miles * KM_PER_MI : miles
}
/** Display value in the unit → miles (for storage). */
export function toMiles(value: number, unit: Unit): number {
  return unit === 'km' ? value / KM_PER_MI : value
}
/** Format a stored mileage for display (number only, no unit label). */
export function fmtDist(miles: number | null | undefined, unit: Unit): string {
  if (miles == null) return ''
  const v = fromMiles(miles, unit)
  return v % 1 ? v.toFixed(1) : String(v)
}
/** Convert a stored pace string "M:SS/mi" to the chosen unit, e.g. "5:17/km". */
export function fmtPace(pace: string | null | undefined, unit: Unit): string {
  if (!pace) return ''
  const m = pace.match(/(\d+):(\d{1,2})/)
  if (!m) return pace
  let sec = Number(m[1]) * 60 + Number(m[2]) // seconds per mile
  if (unit === 'km') sec = Math.round(sec / KM_PER_MI)
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}/${unit}`
}
