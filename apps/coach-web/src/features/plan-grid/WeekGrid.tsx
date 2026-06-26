import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { Workout } from '../../lib/types'
import { DayCard } from './DayCard'
import { DOW, weekDates, fmtShortDate, todayISO } from '../../lib/week'

function DayCell({ date, dow, workout, selected, onSelectDate, onCopy, canPaste, onPaste }: {
  date: string; dow: string; workout: Workout | null; selected: boolean
  onSelectDate: (d: string) => void; onCopy: (w: Workout) => void; canPaste: boolean; onPaste: (d: string) => void
}) {
  const drop = useDroppable({ id: date })
  const drag = useDraggable({ id: date, disabled: !workout })
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
      <div ref={(el) => { drop.setNodeRef(el); drag.setNodeRef(el) }} {...(workout ? { ...drag.attributes, ...drag.listeners } : {})}
        className={`flex-1 rounded-[14px] transition ${drop.isOver ? '-translate-y-0.5 ring-2 ring-accent shadow-[0_0_22px_rgba(173,255,47,0.35)]' : ''}`}>
        <DayCard workout={workout} selected={selected} isToday={isToday}
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
