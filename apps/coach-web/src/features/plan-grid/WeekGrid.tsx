import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Workout } from '../../lib/types'
import { DayCard } from './DayCard'
import { DOW, weekDates, fmtShortDate, todayISO } from '../../lib/week'

/** One workout card, individually draggable (id `w:<workoutId>`). Drag is
 *  disabled for read-only coaches. */
function DraggableWorkout({ workout, selected, canEdit, onClick, onCopy }: {
  workout: Workout; selected: boolean; canEdit: boolean; onClick: () => void; onCopy: () => void
}) {
  const drag = useDraggable({ id: `w:${workout.id}`, disabled: !canEdit })
  // flex-1 so a lone workout fills the cell; multiple share the height.
  return (
    <div ref={drag.setNodeRef} {...(canEdit ? { ...drag.attributes, ...drag.listeners } : {})} className="min-h-0 flex-1">
      <DayCard workout={workout} selected={selected} canEdit={canEdit} onClick={onClick} onCopy={onCopy} />
    </div>
  )
}

function DayCell({ date, dow, workouts, selectedId, canEdit, onSelectWorkout, onCopy, canPaste, onPaste }: {
  date: string; dow: string; workouts: Workout[]; selectedId: string | null; canEdit: boolean
  onSelectWorkout: (date: string, id: string | null) => void
  onCopy: (w: Workout) => void; canPaste: boolean; onPaste: (d: string) => void
}) {
  // Read-only coaches can't drop cards.
  const drop = useDroppable({ id: date, disabled: !canEdit })
  const isToday = date === todayISO()
  return (
    <div className="flex flex-col">
      {/* Fixed-height, single-line header so every card starts at the same Y */}
      <div className="mb-2 flex h-5 items-center gap-1.5 overflow-hidden whitespace-nowrap px-1">
        {isToday
          ? <span className="rounded-[5px] bg-text px-1 py-px text-[9px] font-bold uppercase leading-none tracking-wide text-bg">Today</span>
          : <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-mute">{dow}</span>}
        <span className="font-num text-[10px] tabular-nums text-text-faint">{fmtShortDate(date)}</span>
      </div>
      <div ref={drop.setNodeRef}
        className={`flex min-h-[128px] flex-1 flex-col gap-1.5 rounded-[14px] transition ${isToday ? 'ring-2 ring-text' : ''} ${drop.isOver ? '-translate-y-0.5 ring-2 ring-accent shadow-[0_0_22px_rgba(173,255,47,0.35)]' : ''}`}>
        {workouts.length === 0 ? (
          canEdit ? (
            // Empty day — the add card fills the cell.
            <div className="rb-card rb-card-sm flex flex-1 flex-col items-center justify-center gap-1.5 rounded-[14px] border-dashed text-text-faint">
              {canPaste && (
                <button aria-label="Paste workout" onClick={(e) => { e.stopPropagation(); onPaste(date) }}
                  className="text-xs text-accent hover:brightness-110">Paste</button>
              )}
              <button aria-label="Add workout" onClick={(e) => { e.stopPropagation(); onSelectWorkout(date, null) }}
                className="text-sm hover:text-text">＋ Add</button>
            </div>
          ) : (
            // Read-only + empty: a plain blank cell (blank != rest).
            <div className="rb-card rb-card-sm flex flex-1 items-center justify-center rounded-[14px] border-dashed text-xs text-text-faint" aria-hidden>—</div>
          )
        ) : (
          <>
            {workouts.map((w) => (
              <DraggableWorkout key={w.id} workout={w} selected={w.id === selectedId} canEdit={canEdit}
                onClick={() => onSelectWorkout(date, w.id)} onCopy={() => onCopy(w)} />
            ))}
            {/* Slim sliver so a single workout keeps the card; add another below. Edit coaches only. */}
            {canEdit && (
              <div className="flex shrink-0 items-center gap-1">
                {canPaste && (
                  <button aria-label="Paste workout" onClick={(e) => { e.stopPropagation(); onPaste(date) }}
                    className="rounded-[8px] border border-dashed border-line px-2 py-1 text-[11px] leading-none text-accent hover:brightness-110">Paste</button>
                )}
                <button aria-label="Add workout" onClick={(e) => { e.stopPropagation(); onSelectWorkout(date, null) }}
                  className="flex-1 rounded-[8px] border border-dashed border-line py-1 text-center text-[11px] leading-none text-text-faint transition hover:border-text-mute hover:text-text-mute">＋ Add</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export function WeekGrid({ monday, week, selectedId, onSelectWorkout, onCopy, canPaste, onPaste, canEdit = true }: {
  monday: string; week: Workout[][]; selectedId: string | null
  onSelectWorkout: (date: string, id: string | null) => void; onCopy: (w: Workout) => void
  canPaste: boolean; onPaste: (date: string) => void; canEdit?: boolean
}) {
  const dates = weekDates(monday)
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7 md:gap-3">
      {dates.map((date, i) => (
        <DayCell key={date} date={date} dow={DOW[i]} workouts={week[i] ?? []} selectedId={selectedId} canEdit={canEdit}
          onSelectWorkout={onSelectWorkout} onCopy={onCopy} canPaste={canPaste} onPaste={onPaste} />
      ))}
    </div>
  )
}
