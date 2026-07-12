import type { WorkoutType } from '../../lib/types'

/** Workout-type icons aligned with the athlete iOS app's SF Symbol metaphors
 *  (runner, arrow-to-line, bolt, gauge, heart-renewal, bicycle, crescent-zzz,
 *  checkered flag) — redrawn as original line art (SF Symbols are
 *  Apple-platform-only, so the glyphs themselves can't ship on the web). */
const TYPE_GLYPH: Record<string, React.ReactNode> = {
  // figure.run — stick runner mid-stride
  easy: (
    <>
      <circle cx="13.5" cy="4.6" r="1.7" />
      <path d="M12.8 7.4L11 12M8.6 9.8l3.4-1.6 2.6 1.4 2.4 2.6M11 12l-2.4 4.2L6 18.4M11 12l2.2 3.2 2.8 1.8" />
    </>
  ),
  // arrow.right.to.line — long steady push to the finish
  long: <path d="M3.5 12h12M11 7l5 5-5 5M20.5 6v12" />,
  // bolt — intervals/speed
  speed: <path d="M13 2L4 14h6l-1 8 9-12h-6z" />,
  // gauge.with.needle — tempo effort
  tempo: (
    <>
      <path d="M5 16.5a8 8 0 1114 0" />
      <path d="M12 14.5l3.6-4.6" />
      <circle cx="12" cy="15" r="1" />
    </>
  ),
  // arrow.clockwise.heart — recovery/renewal
  recovery: (
    <>
      <path d="M12 20.5s-6-3.9-6-8.4a3.4 3.4 0 016-2.2 3.4 3.4 0 016 2.2c0 4.5-6 8.4-6 8.4z" />
      <path d="M8.5 4.5a5.5 5.5 0 017.6.9M16.5 3v2.8h-2.8" />
    </>
  ),
  // bicycle — cross-training
  cross: (
    <>
      <circle cx="6" cy="16.5" r="3.2" />
      <circle cx="18" cy="16.5" r="3.2" />
      <path d="M6 16.5l3.6-6.3h4.9l3.5 6.3M9.6 10.2L8.2 7.6h-2M13 7.2h2.6" />
    </>
  ),
  // moon.zzz — rest day
  rest: (
    <>
      <path d="M10.5 4.5a7.3 7.3 0 108.6 8.6 6 6 0 01-8.6-8.6z" />
      <path d="M15.5 3.5h4l-4 4h4" />
    </>
  ),
  // flag.checkered — race day
  race: (
    <>
      <path d="M5 21V4M5 4h14v8H5" />
      <rect x="7" y="5.5" width="2.6" height="2.6" fill="currentColor" stroke="none" />
      <rect x="12.2" y="5.5" width="2.6" height="2.6" fill="currentColor" stroke="none" />
      <rect x="9.6" y="8.1" width="2.6" height="2.6" fill="currentColor" stroke="none" />
      <rect x="14.8" y="8.1" width="2.6" height="2.6" fill="currentColor" stroke="none" />
    </>
  ),
  // ellipsis.circle — anything else (strength, mobility, drills…); metric-free
  other: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="7.8" cy="12" r="0.4" fill="currentColor" />
      <circle cx="12" cy="12" r="0.4" fill="currentColor" />
      <circle cx="16.2" cy="12" r="0.4" fill="currentColor" />
    </>
  ),
}

/** Per-type tints mirroring the athlete iOS app's TypeBadge (iOS system palette,
 *  dark variants): effort types orange, long blue, aerobic green; rest inherits
 *  the surrounding muted color. Pass tinted={false} to fall back to currentColor. */
const TYPE_TINT: Record<string, string> = {
  speed: '#FF9F0A', tempo: '#FF9F0A', race: '#FF9F0A',
  long: '#0A84FF',
  easy: '#30D158', recovery: '#30D158', cross: '#30D158',
}

export function TypeIcon({ type, className = '', tinted = true }: { type: WorkoutType; className?: string; tinted?: boolean }) {
  const tint = tinted ? TYPE_TINT[type] : undefined
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} style={tint ? { color: tint } : undefined}
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {TYPE_GLYPH[type] ?? TYPE_GLYPH.easy}
    </svg>
  )
}
