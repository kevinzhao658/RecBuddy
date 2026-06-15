import type { Workout } from '../../lib/types'
import { DayCard } from './DayCard'
import { DOW, weekDates } from '../../lib/week'

export function WeekGrid({ monday, week, selectedDate, onSelectDate, onCopy }: {
  monday: string; week: (Workout | null)[]; selectedDate: string | null
  onSelectDate: (date: string) => void; onCopy: (w: Workout) => void
}) {
  const dates = weekDates(monday)
  return (
    <div className="grid grid-cols-7 gap-3">
      {dates.map((date, i) => (
        <DayCard key={date} date={date} dow={DOW[i]} workout={week[i]} selected={selectedDate === date}
          onClick={() => onSelectDate(date)} onCopy={() => week[i] && onCopy(week[i]!)} />
      ))}
    </div>
  )
}
