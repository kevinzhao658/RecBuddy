import { useState } from 'react'
import type { Workout } from '../../lib/types'
export function useClipboard() {
  const [clip, setClip] = useState<Workout | null>(null)
  return { clip, copy: setClip, clear: () => setClip(null) }
}
