import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Workout } from '../../lib/types'
import { DayCard } from './DayCard'
import { DOW, weekDates, fmtShortDate, todayISO } from '../../lib/week'

/** One workout card, individually draggable (id `w:<workoutId>`). */
function DraggableWorkout({ workout, selected, onClick, onCopy }: {
  workout: Workout; selected: boolean; onClick: () => void; onCopy: () => void
}) {
  const drag = useDraggable({ id: `w:${workout.id}` })
  return (
    <div ref={drag.setNodeRef} {...drag.attributes} {...drag.listeners}>
      <DayCard workout={workout} selected={selected} onClick={onClick} onCopy={onCopy} />
    </div>
  )
}

function DayCell({ date, dow, workouts, selectedId, onSelectWorkout, onCopy, canPaste, onPaste }: {
  date: string; dow: string; workouts: Workout[]; selectedId: string | null
  onSelectWorkout: (date: string, id: string | null) => void
  onCopy: (w: Workout) => void; canPaste: boolean; onPaste: (d: string) => void
}) {
  const drop = useDroppable({ id: date })
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
        {workouts.map((w) => (
          <DraggableWorkout key={w.id} workout={w} selected={w.id === selectedId}
            onClick={() => onSelectWorkout(date, w.id)} onCopy={() => onCopy(w)} />
        ))}
        <div className={`flex flex-1 flex-col items-center justify-center gap-1 rounded-[14px] py-2 text-text-faint ${workouts.length === 0 ? 'rb-card rb-card-sm border-dashed' : ''}`}>
          {canPaste && (
            <button aria-label="Paste workout" onClick={(e) => { e.stopPropagation(); onPaste(date) }}
              className="text-sm text-accent hover:brightness-110">Paste</button>
          )}
          <button aria-label="Add workout" onClick={(e) => { e.stopPropagation(); onSelectWorkout(date, null) }}
            className="hover:text-text">＋ Add</button>
        </div>
      </div>
    </div>
  )
}

export function WeekGrid({ monday, week, selectedId, onSelectWorkout, onCopy, canPaste, onPaste }: {
  monday: string; week: Workout[][]; selectedId: string | null
  onSelectWorkout: (date: string, id: string | null) => void; onCopy: (w: Workout) => void
  canPaste: boolean; onPaste: (date: string) => void
}) {
  const dates = weekDates(monday)
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-7 md:gap-3">
      {dates.map((date, i) => (
        <DayCell key={date} date={date} dow={DOW[i]} workouts={week[i] ?? []} selectedId={selectedId}
          onSelectWorkout={onSelectWorkout} onCopy={onCopy} canPaste={canPaste} onPaste={onPaste} />
      ))}
    </div>
  )
}
