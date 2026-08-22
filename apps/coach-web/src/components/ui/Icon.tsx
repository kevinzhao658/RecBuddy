import type { WorkoutType } from '../../lib/types'

/** Workout-type icons aligned with the athlete iOS app's SF Symbol metaphors
 *  (runner, arrow-to-line, bolt, gauge, heart, circling-arcs, crescent-zzz,
 *  checkered flag) — redrawn as original line art (SF Symbols are
 *  Apple-platform-only, so the glyphs themselves can't ship on the web).
 *  Colored per TYPE_TINT below. */
/** Intensity tints (match athlete iOS): orange = effort, blue = long, green =
 *  aerobic, muted grey = off (rest/other). Accent-only was tried and
 *  reverted — color answers "which days are hard" at a glance. */
const TYPE_TINT: Record<string, string> = {
  speed: '#FF9F0A', tempo: '#FF9F0A', race: '#FF9F0A',
  long: '#0A84FF',
  easy: '#30D158', recovery: '#30D158', cross: '#30D158',
  // Off days stay muted grey (matches iOS .secondary) — never the accent.
  rest: 'rgba(243, 251, 232, 0.56)', other: 'rgba(243, 251, 232, 0.56)',
}

const TYPE_GLYPH: Record<string, React.ReactNode> = {
  // arrow.right — easy forward motion (the runner now lives on the run SPORT glyph)
  easy: <path d="M4 12h14M13 6l6 6-6 6" />,
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
  // heart — recovery (the refresh arrow now belongs to Cross)
  recovery: (
    <path d="M12 20.5s-6.5-4.2-6.5-9a3.7 3.7 0 016.5-2.4 3.7 3.7 0 016.5 2.4c0 4.8-6.5 9-6.5 9z" />
  ),
  // arrow.2.circlepath — cross-training: two arcs chasing each other
  cross: (
    <>
      <path d="M5.2 13.5a7 7 0 0 1 11.6-6.9" />
      <polyline points="16.6 2.9 16.9 6.7 13.1 7" />
      <path d="M18.8 10.5a7 7 0 0 1-11.6 6.9" />
      <polyline points="7.4 21.1 7.1 17.3 10.9 17" />
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

export function TypeIcon({ type, className = '' }: { type: WorkoutType; className?: string }) {
  const tint = TYPE_TINT[type]
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`} style={tint ? { color: tint } : undefined}
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {TYPE_GLYPH[type] ?? TYPE_GLYPH.easy}
    </svg>
  )
}

/** Sport glyphs for logged activities (declared run/ride/swim) — used where a
 *  result is shown by SPORT rather than by prescribed workout type (extras,
 *  cross per-sport totals). ONE drawing per metaphor across the whole app:
 *  run keeps the runner, ride has its own bicycle, and
 *  every glyph is posed to mirror the athlete iOS app's SF Symbol so the two
 *  clients read in unison (SF Symbols themselves are Apple-platform-only and
 *  can't ship on the web). Uncolored: callers tint via text color classes. */
const SPORT_GLYPH: Record<string, React.ReactNode> = {
  // figure.run — a logged run keeps the runner (the easy TYPE moved to an arrow)
  run: (
    <>
      <circle cx="13.5" cy="4.6" r="1.7" />
      <path d="M12.8 7.4L11 12M8.6 9.8l3.4-1.6 2.6 1.4 2.4 2.6M11 12l-2.4 4.2L6 18.4M11 12l2.2 3.2 2.8 1.8" />
    </>
  ),
  // bicycle — a logged ride IS a bike ride; only the cross TYPE stopped being one
  ride: (
    <>
      <circle cx="6" cy="16.5" r="3.2" />
      <circle cx="18" cy="16.5" r="3.2" />
      <path d="M6 16.5l3.6-6.3h4.9l3.5 6.3M9.6 10.2L8.2 7.6h-2M13 7.2h2.6" />
    </>
  ),
  swim: (
    <>
      <circle cx="15.5" cy="6.5" r="1.8" />
      <path d="M4 11.5 9 9l4 3.5-3 2" />
      <path d="M3 18c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0" />
    </>
  ),
}

export function SportIcon({ sport, className = '' }: { sport: 'run' | 'ride' | 'swim'; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 ${className}`}
      fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {SPORT_GLYPH[sport]}
    </svg>
  )
}
