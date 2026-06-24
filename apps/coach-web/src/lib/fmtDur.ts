export function fmtDur(min: number): string {
  if (!min) return '0m'
  const h = Math.floor(min / 60), m = min % 60
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`
}
