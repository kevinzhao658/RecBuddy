import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Workout } from '../../lib/types'
import { DayCard } from './DayCard'
import { DOW, weekDates, fmtShortDate } from '../../lib/week'

const today = () => new Date().toISOString().slice(0, 10)

function DayCell({ date, dow, workout, selected, onSelectDate, onCopy, canPaste, onPaste }: {
  date: string; dow: string; workout: Workout | null; selected: boolean
  onSelectDate: (d: string) => void; onCopy: (w: Workout) => void; canPaste: boolean; onPaste: (d: string) => void
}) {
  const drop = useDroppable({ id: date })
  const drag = useDraggable({ id: date, disabled: !workout })
  const isToday = date === today()
  return (
    <div className="flex flex-col">
      {/* Column header (weekday · date) sits in the frame behind the cards */}
      <div className="mb-2 flex items-baseline gap-2 px-1">
        {isToday
          ? <span className="rounded-[6px] bg-text px-1.5 py-[3px] text-[10px] font-bold uppercase tracking-wide text-bg">Today</span>
          : <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-mute">{dow}</span>}
        <span className="font-num text-[11px] tabular-nums text-text-faint">{fmtShortDate(date)}</span>
      </div>
      <div ref={(el) => { drop.setNodeRef(el); drag.setNodeRef(el) }} {...(workout ? { ...drag.attributes, ...drag.listeners } : {})}
        className={`flex-1 rounded-[14px] ${drop.isOver ? 'ring-2 ring-accent/40' : ''}`}>
        <DayCard workout={workout} selected={selected}
          onClick={() => onSelectDate(date)} onCopy={() => workout && onCopy(workout)}
          canPaste={!workout && canPaste} onPaste={() => onPaste(date)} />
      </div>
    </div>
  )
}

export function WeekGrid({ monday, week, selectedDate, onSelectDate, onCopy, canPaste, onPaste }: {
  monday: string; week: (Workout | null)[]; selectedDate: string | null
  onSelectDate: (date: string) => void; onCopy: (w: Workout) => void
  canPaste: boolean; onPaste: (date: string) => void
}) {
  const dates = weekDates(monday)
  return (
    <div className="grid grid-cols-7 gap-3">
      {dates.map((date, i) => (
        <DayCell key={date} date={date} dow={DOW[i]} workout={week[i]} selected={selectedDate === date}
          onSelectDate={onSelectDate} onCopy={onCopy} canPaste={canPaste} onPaste={onPaste} />
      ))}
    </div>
  )
}
