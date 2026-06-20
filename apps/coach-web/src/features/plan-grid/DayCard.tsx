import type { Workout } from '../../lib/types'
import { TypeIcon } from '../../components/ui/Icon'

// Completion status is the ONLY thing that colors a card (lime=done, red=missed,
// bright neutral=today). Workout type stays a neutral icon.
const STATUS_TREATMENT: Record<string, string> = {
  done: 'ring-1 ring-accent/40 bg-[rgba(173,255,47,0.10)]',
  missed: 'ring-1 ring-missed/50 bg-[rgba(255,90,82,0.10)]',
  today: 'ring-2 ring-text',
  planned: '',
  rest: '',
}
const STATUS_DOT: Record<string, string> = { done: 'text-accent', missed: 'text-missed', today: 'text-text', planned: 'text-text-faint', rest: 'text-text-faint' }

export function DayCard({ date: _date, dow, workout, selected, onClick, onCopy, canPaste, onPaste }: {
  date: string; dow: string; workout: Workout | null; selected: boolean; onClick: () => void; onCopy: () => void
  canPaste?: boolean; onPaste?: () => void
}) {
  return (
    <div onClick={onClick}
      className={`rb-card rb-card-sm flex min-h-[120px] cursor-pointer flex-col p-3 ${selected ? 'ring-2 ring-text/30' : ''} ${workout ? STATUS_TREATMENT[workout.status] : 'border-dashed'}`}>
      <div className="mb-1 flex items-center justify-between text-xs text-text-mute">
        <span className="flex items-center gap-1.5">{dow}{workout?.status === 'today' && (
          <span className="rounded-[6px] bg-text px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-bg">Today</span>
        )}</span>
        {workout && <TypeIcon type={workout.type} className="text-text-mute" />}
      </div>
      {workout ? (
        <>
          <div className="text-[14.5px] font-semibold leading-tight">{workout.title}</div>
          {workout.dist != null && <div className="font-num text-xs text-text-mute">{workout.dist} mi · {workout.pace}</div>}
          <div className="mt-auto flex items-center justify-between pt-2">
            <span className={`text-xs ${STATUS_DOT[workout.status]}`}>● {workout.status}</span>
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
