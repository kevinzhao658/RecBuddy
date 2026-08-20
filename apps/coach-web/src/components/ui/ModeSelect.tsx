import type { VolumeMode } from '../../lib/volume'

/** Sport dropdown for volume gauges (Run / Cross today; per-sport bike/swim
 *  splits may append later). Callers render it ONLY when cross volume exists,
 *  so run-only athletes never see extra chrome. Controlled: one volumeMode
 *  lives in CoachPage and drives every gauge surface together. */
export function ModeSelect({ mode, onChange }: {
  mode: VolumeMode; onChange: (m: VolumeMode) => void
}) {
  return (
    <span className="relative inline-flex shrink-0 items-center">
      <select value={mode} aria-label="Volume sport"
        onChange={(e) => onChange(e.target.value as VolumeMode)}
        className="appearance-none rounded-[9px] border border-line bg-surface2 py-1 pl-2.5 pr-6 text-[11px] font-semibold text-text transition hover:border-text-mute focus:outline-none focus:ring-1 focus:ring-accent">
        <option value="run">Run</option>
        <option value="cross">Cross</option>
      </select>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute right-1.5 h-3 w-3 text-text-faint"
        fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  )
}
