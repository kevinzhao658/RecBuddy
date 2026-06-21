import type { Workout } from '../../lib/types'
import { TypeIcon } from '../../components/ui/Icon'

// Completion status is the ONLY thing that colors a card (lime=done, red=missed).
// The current day is outlined by DATE (isToday), independent of status. Workout
// type stays a neutral icon.
const STATUS_BG: Record<string, string> = {
  done: 'bg-[rgba(173,255,47,0.10)]', missed: 'bg-[rgba(255,90,82,0.10)]', today: '', planned: '', rest: '',
}
const STATUS_RING: Record<string, string> = {
  done: 'ring-1 ring-accent/45', missed: 'ring-1 ring-missed/50', today: '', planned: '', rest: '',
}
const STATUS_DOT: Record<string, string> = { done: 'text-accent', missed: 'text-missed', today: 'text-text-faint', planned: 'text-text-faint', rest: 'text-text-faint' }
const STATUS_LABEL: Record<string, string> = { done: 'Completed', missed: 'Missed', today: 'Planned', planned: 'Planned', rest: 'Rest' }

export function DayCard({ workout, selected, isToday, onClick, onCopy, canPaste, onPaste }: {
  workout: Workout | null; selected: boolean; isToday?: boolean; onClick: () => void; onCopy: () => void
  canPaste?: boolean; onPaste?: () => void; date?: string; dow?: string
}) {
  // Today's bright ring wins; otherwise the completion-status ring; otherwise selection.
  const ring = isToday ? 'ring-2 ring-text' : workout ? STATUS_RING[workout.status] : ''
  const selRing = selected && !isToday ? 'ring-2 ring-text/30' : ''
  return (
    <div onClick={onClick}
      className={`rb-card rb-card-sm flex h-[128px] cursor-pointer flex-col p-3 ${selRing} ${workout ? STATUS_BG[workout.status] : 'border-dashed'} ${ring}`}>
      {workout ? (
        <>
          <div className="mb-1 flex items-start justify-between gap-2">
            <div className="line-clamp-2 text-[14px] font-semibold leading-tight">{workout.title}</div>
            <TypeIcon type={workout.type} className="mt-0.5 shrink-0 text-text-mute" />
          </div>
          {workout.dist != null && <div className="font-num text-xs text-text-mute">{workout.dist} mi · {workout.pace}</div>}
          <div className="mt-auto flex items-center justify-between pt-2">
            <span className={`flex items-center gap-1 text-xs ${STATUS_DOT[workout.status]}`}>
              <span aria-hidden>{workout.status === 'done' ? '✓' : '●'}</span>{STATUS_LABEL[workout.status]}
            </span>
            <button aria-label="Copy workout" onClick={(e) => { e.stopPropagation(); onCopy() }} className="text-text-faint hover:text-text">⧉</button>
          </div>
        </>
      ) : (
        <div className="m-auto flex flex-col items-center gap-1 text-text-faint">
          {canPaste && <button aria-label="Paste workout" onClick={(e) => { e.stopPropagation(); onPaste?.() }} className="text-sm text-accent hover:brightness-110">Paste</button>}
          <span>＋ Add</span>
        </div>
      )}
    </div>
  )
}
