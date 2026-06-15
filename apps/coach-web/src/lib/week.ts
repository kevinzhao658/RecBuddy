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
