import type { Workout } from '../../lib/types'
import { TypeIcon } from '../../components/ui/Icon'

// A collapsed workout in a stacked day: icon + title only. The status mark
// (done/missed) stays visible so a coach reads the day at a glance without
// promoting the card.
const STATUS_MARK: Record<string, string> = { done: '✓', missed: '✕' }
const STATUS_TINT: Record<string, string> = { done: 'text-accent', missed: 'text-missed' }

/** A tab poking out from behind the headline card — one of the day's other
 *  workouts. Squared top (it slides under the card) and a rounded bottom edge
 *  read as a drawer rather than a floating pill; content sits low so it stays
 *  in the exposed strip. Hovering nudges it out; clicking floats it to the top. */
export function WorkoutSliver({ workout, onClick }: { workout: Workout; onClick: () => void }) {
  return (
    <button type="button" aria-label={`Show ${workout.title}`}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className="flex h-8 w-full items-end gap-1.5 rounded-b-[13px] border border-t-0 border-line bg-surface2 px-2 pb-1.5 text-left shadow-[0_3px_7px_rgba(0,0,0,0.30)] transition duration-150 ease-out hover:translate-y-1 hover:brightness-125">
      <TypeIcon type={workout.type} className="shrink-0" />
      <span className="line-clamp-1 flex-1 text-[12px] font-medium leading-none text-text-mute">{workout.title}</span>
      {STATUS_MARK[workout.status] && <span className={`text-xs leading-none ${STATUS_TINT[workout.status]}`}>{STATUS_MARK[workout.status]}</span>}
    </button>
  )
}
