import type { Workout } from '../../lib/types'
import { DOW, monthGridDates, monthOf } from '../../lib/week'
import { TypeIcon } from '../../components/ui/Icon'

const today = () => new Date().toISOString().slice(0, 10)

function WorkoutChip({ w }: { w: Workout }) {
  const tone =
    w.status === 'done' ? 'border-accent/40 bg-[rgba(173,255,47,0.10)] text-text'
    : w.status === 'missed' ? 'border-missed/40 bg-[rgba(255,90,82,0.10)] text-text'
    : 'border-line bg-surface2 text-text-mute'
  return (
    <span className={`flex items-center gap-1 truncate rounded-[7px] border px-1.5 py-1 text-[11px] ${tone}`}>
      <TypeIcon type={w.type} className="h-3 w-3 shrink-0" />
      <span className="truncate">{w.title}</span>
    </span>
  )
}

export function MonthGrid({ anchor, byDate, selectedDate, onPick }: {
  anchor: string; byDate: Record<string, Workout>; selectedDate: string | null; onPick: (date: string) => void
}) {
  const dates = monthGridDates(anchor)
  const m = monthOf(anchor)
  const todayIso = today()
  return (
    <div className="rb-card overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b border-line">
        {DOW.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-text-mute">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dates.map((date) => {
          const w = byDate[date]
          const inMonth = monthOf(date) === m
          const isToday = date === todayIso
          const isSel = date === selectedDate
          const day = Number(date.slice(8, 10))
          return (
            <button key={date} onClick={() => onPick(date)}
              className={`flex min-h-[96px] flex-col gap-1 border-b border-r border-line p-1.5 text-left transition hover:bg-surface2 ${inMonth ? '' : 'opacity-35'} ${isSel ? 'bg-surface2 ring-2 ring-inset ring-accent' : ''}`}>
              <span className={`flex h-5 w-5 items-center justify-center rounded-full font-num text-xs ${isToday ? 'bg-text font-bold text-bg' : 'text-text-mute'}`}>{day}</span>
              {w && <WorkoutChip w={w} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
