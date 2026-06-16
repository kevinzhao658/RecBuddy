import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Workout } from '../../lib/types'
import { DayCard } from './DayCard'
import { DOW, weekDates } from '../../lib/week'

function DayCell({ date, dow, workout, selected, onSelectDate, onCopy, canPaste, onPaste }: {
  date: string; dow: string; workout: Workout | null; selected: boolean
  onSelectDate: (d: string) => void; onCopy: (w: Workout) => void; canPaste: boolean; onPaste: (d: string) => void
}) {
  const drop = useDroppable({ id: date })
  const drag = useDraggable({ id: date, disabled: !workout })
  return (
    <div ref={(el) => { drop.setNodeRef(el); drag.setNodeRef(el) }} {...(workout ? { ...drag.attributes, ...drag.listeners } : {})}
      className={drop.isOver ? 'rounded-[14px] ring-2 ring-accent/40' : ''}>
      <DayCard date={date} dow={dow} workout={workout} selected={selected}
        onClick={() => onSelectDate(date)} onCopy={() => workout && onCopy(workout)}
        canPaste={!workout && canPaste} onPaste={() => onPaste(date)} />
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
