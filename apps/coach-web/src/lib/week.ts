export function addDays(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export function mondayOf(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z'); const dow = (d.getUTCDay() + 6) % 7 // Mon=0
  return addDays(iso, -dow)
}
export function weekDates(mondayIso: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(mondayIso, i))
}
export const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const FULLMON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

/** First day of the month containing `iso`: '2026-06-21' -> '2026-06-01'. */
export function firstOfMonth(iso: string): string { return iso.slice(0, 8) + '01' }

/** Add `n` calendar months (call on a day-01 date to avoid end-of-month rollover). */
export function addMonths(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00Z'); d.setUTCMonth(d.getUTCMonth() + n)
  return d.toISOString().slice(0, 10)
}

/** Mon-first calendar grid (35 or 42 days) covering the month containing `anchor`. */
export function monthGridDates(anchor: string): string[] {
  const first = firstOfMonth(anchor)
  const start = mondayOf(first)
  const lastDay = addDays(addMonths(first, 1), -1)
  const end = addDays(mondayOf(lastDay), 6)
  const span = Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1
  return Array.from({ length: span }, (_, i) => addDays(start, i))
}

/** Today's calendar date 'YYYY-MM-DD' in the user's LOCAL timezone (so the
 *  "today" highlight matches what the user sees, not the UTC date). */
export function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function monthOf(iso: string): number { return new Date(iso + 'T00:00:00Z').getUTCMonth() }
/** '2026-06-21' -> 'June 2026'. */
export function fmtMonthYear(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return `${FULLMON[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

/** '2026-08-23' -> 'Aug 23' (UTC, returns '' for null). */
export function fmtShortDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso + 'T00:00:00Z')
  if (isNaN(d.getTime())) return iso // already a display string, leave as-is
  return `${MON[d.getUTCMonth()]} ${d.getUTCDate()}`
}
