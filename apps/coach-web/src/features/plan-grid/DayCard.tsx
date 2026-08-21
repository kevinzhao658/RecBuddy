import type { Workout } from '../../lib/types'
import { TypeIcon } from '../../components/ui/Icon'
import { useUnit } from '../../lib/useUnit'
import { fmtDist, fmtPace } from '../../lib/units'

// Completion status is the ONLY thing that colors a card (lime=done, red=missed).
// The current day is outlined on the CELL by date (WeekGrid), not here. Workout
// type stays a neutral icon.
const STATUS_BG: Record<string, string> = {
  done: 'bg-[rgba(173,255,47,0.10)]', missed: 'bg-[rgba(255,90,82,0.10)]', today: '', planned: '', rest: '',
}
const STATUS_RING: Record<string, string> = {
  done: 'ring-1 ring-accent/45', missed: 'ring-1 ring-missed/50', today: '', planned: '', rest: '',
}
const STATUS_DOT: Record<string, string> = { done: 'text-accent', missed: 'text-missed', today: 'text-text-faint', planned: 'text-text-faint', rest: 'text-text-faint' }
const STATUS_LABEL: Record<string, string> = { done: 'Completed', missed: 'Missed', today: 'Planned', planned: 'Planned', rest: 'Rest' }

/** One compact workout card — a day stacks any number of these. Read-only
 *  coaches (`canEdit=false`) lose the copy affordance. */
export function DayCard({ workout, selected, onClick, onCopy, canEdit = true }: {
  workout: Workout; selected: boolean; onClick: () => void; onCopy: () => void; canEdit?: boolean
}) {
  const { unit } = useUnit()
  // Selection wins (clear lime outline), then status.
  const ring = selected ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : STATUS_RING[workout.status]
  return (
    <div onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`rb-card rb-card-sm flex h-full cursor-pointer flex-col p-2 ${STATUS_BG[workout.status]} ${ring}`}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="line-clamp-1 text-[14px] font-semibold leading-tight">{workout.title}</div>
        <TypeIcon type={workout.type} className="mt-0.5 shrink-0 text-accent" />
      </div>
      {workout.dist != null && <div className="font-num text-xs text-text-mute">{fmtDist(workout.dist, unit)} {unit} · {fmtPace(workout.pace, unit)}</div>}
      <div className="mt-auto flex items-center justify-between pt-1.5">
        <span className={`text-sm leading-none ${STATUS_DOT[workout.status]}`} aria-label={STATUS_LABEL[workout.status]}>
          {workout.status === 'done' ? '✓' : workout.status === 'missed' ? '✕' : ''}
        </span>
        {canEdit && <button aria-label="Copy workout" onClick={(e) => { e.stopPropagation(); onCopy() }} className="text-text-faint hover:text-text">⧉</button>}
      </div>
    </div>
  )
}
