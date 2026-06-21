import type { WorkoutType } from '../../lib/types'
import { TypeIcon } from '../../components/ui/Icon'

const TYPES: [WorkoutType, string][] = [
  ['easy', 'Easy'], ['long', 'Long'], ['speed', 'Intervals'], ['tempo', 'Tempo'],
  ['recovery', 'Recovery'], ['cross', 'Cross-train'], ['rest', 'Rest'],
]

/** Decode key: type icon → name, and the completion-status colors. */
export function WorkoutKey() {
  return (
    <div className="rb-card rb-card-sm mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 p-4">
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-faint">Workout key</span>
      {TYPES.map(([t, label]) => (
        <span key={t} className="flex items-center gap-1.5 text-xs text-text-mute">
          <TypeIcon type={t} className="h-3.5 w-3.5 text-text-mute" />{label}
        </span>
      ))}
      <span className="mx-1 h-4 w-px bg-line" />
      <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-faint">Status</span>
      <span className="flex items-center gap-1.5 text-xs text-text-faint"><span aria-hidden>●</span>Planned</span>
      <span className="flex items-center gap-1.5 text-xs text-accent"><span aria-hidden>✓</span>Completed</span>
      <span className="flex items-center gap-1.5 text-xs text-missed"><span aria-hidden>●</span>Missed</span>
    </div>
  )
}
