import type { WorkoutType } from '../../lib/types'
import { TypeIcon } from '../../components/ui/Icon'
import { useUnit } from '../../lib/useUnit'
import { fmtDist, fmtPace } from '../../lib/units'

type Ghost = { type: WorkoutType; title: string; dist: number | null; pace: string | null }

/** The card rendered under the cursor while dragging (inside dnd-kit's DragOverlay). */
export function DragGhost({ workout }: { workout: Ghost | null }) {
  const { unit } = useUnit()
  if (!workout) return null
  return (
    <div className="rb-card rb-card-sm flex w-60 rotate-2 cursor-grabbing items-center gap-2 p-3 shadow-2xl ring-1 ring-accent/50">
      <TypeIcon type={workout.type} className="shrink-0 text-text-mute" />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold">{workout.title}</div>
        {workout.dist != null && <div className="font-num text-xs text-text-mute">{fmtDist(workout.dist, unit)} {unit} · {fmtPace(workout.pace, unit)}</div>}
      </div>
    </div>
  )
}
