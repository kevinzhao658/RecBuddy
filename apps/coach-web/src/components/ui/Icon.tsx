import type { WorkoutType } from '../../lib/types'
const TYPE_GLYPH: Record<string, string> = {
  easy: 'M6 19l4-9 3 5 2-3 3 7', long: 'M3 18l5-9 4 6 3-4 6 7', speed: 'M13 2L4 14h6l-1 8 9-12h-6z',
  tempo: 'M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z', recovery: 'M12 21s-7-4.35-7-10a4 4 0 017-2 4 4 0 017 2c0 5.65-7 10-7 10z',
  cross: 'M5 5l14 14M19 5L5 19', rest: 'M4 12h6l-3 5h6', race: 'M5 3v18M5 4h11l-2 4 2 4H5',
}
export function TypeIcon({ type, className = '' }: { type: WorkoutType; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={TYPE_GLYPH[type] ?? TYPE_GLYPH.easy} />
    </svg>
  )
}
