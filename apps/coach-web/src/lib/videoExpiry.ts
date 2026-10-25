/** When a chat video's server copy goes away, and what a bubble can show.
 *  Mirrors iOS VideoText.expiry / VideoState. */

const DAY = 86_400_000

/** "Expires in 3 days" / "Expires in 1 day" / "Expires today"; null once expired. */
export function expiryLabel(expiresAt: string, now: Date = new Date()): string | null {
  const left = new Date(expiresAt).getTime() - now.getTime()
  if (!(left > 0)) return null
  const days = Math.floor(left / DAY)
  if (days === 0) return 'Expires today'
  return days === 1 ? 'Expires in 1 day' : `Expires in ${days} days`
}

export type VideoState = 'local' | 'remote' | 'expired'

/** A copy on this device always plays; otherwise the server copy, while it lasts. */
export function videoState(s: { hasLocal: boolean; purged: boolean; expired: boolean }): VideoState {
  if (s.hasLocal) return 'local'
  return s.purged || s.expired ? 'expired' : 'remote'
}
