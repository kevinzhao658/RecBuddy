import { useEffect, useState } from 'react'

/** Countdown lock for rate-limited actions (e.g. resending an email).
 *  `start(s)` locks for `s` seconds; `remaining` is whole seconds left (0 = unlocked). */
export function useCooldown() {
  const [until, setUntil] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!until) return
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= until) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [until])

  function start(seconds: number) {
    const t = Date.now()
    setNow(t)
    setUntil(t + seconds * 1000)
  }

  return { remaining: Math.max(0, Math.ceil((until - now) / 1000)), start }
}
