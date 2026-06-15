import type { Workout } from '../../lib/types'
import { TypeIcon } from '../../components/ui/Icon'

const STATUS_RING: Record<string, string> = { done: 'border-accent', missed: 'border-missed', today: 'border-text', planned: 'border-line', rest: 'border-line' }
const STATUS_DOT: Record<string, string> = { done: 'text-accent', missed: 'text-missed', today: 'text-text', planned: 'text-text-faint', rest: 'text-text-faint' }

export function DayCard({ date: _date, dow, workout, selected, onClick, onCopy, canPaste, onPaste }: {
  date: string; dow: string; workout: Workout | null; selected: boolean; onClick: () => void; onCopy: () => void
  canPaste?: boolean; onPaste?: () => void
}) {
  return (
    <div onClick={onClick}
      className={`flex min-h-[120px] cursor-pointer flex-col rounded-[14px] border bg-surface p-3 ${selected ? 'ring-2 ring-text/30' : ''} ${workout ? STATUS_RING[workout.status] : 'border-dashed border-line'}`}>
      <div className="mb-1 flex items-center justify-between text-xs text-text-mute">
        <span>{dow}</span>{workout && <TypeIcon type={workout.type} className="text-text-mute" />}
      </div>
      {workout ? (
        <>
          <div className="font-semibold leading-tight">{workout.title}</div>
          {workout.dist != null && <div className="text-sm text-text-mute">{workout.dist} mi · {workout.pace}</div>}
          <div className="mt-auto flex items-center justify-between pt-2">
            <span className={`text-xs ${STATUS_DOT[workout.status]}`}>● {workout.status}</span>
            <button aria-label="Copy workout" onClick={(e) => { e.stopPropagation(); onCopy() }} className="text-text-faint">⧉</button>
          </div>
        </>
      ) : (
        <div className="m-auto flex flex-col items-center gap-1 text-text-faint">
          {canPaste && <button aria-label="Paste workout" onClick={(e) => { e.stopPropagation(); onPaste?.() }} className="text-accent text-sm">Paste</button>}
          <span>＋ Add</span>
        </div>
      )}
    </div>
  )
}
