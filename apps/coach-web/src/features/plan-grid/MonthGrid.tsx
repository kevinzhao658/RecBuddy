import { Fragment } from 'react'
import type { Workout, WorkoutStatus } from '../../lib/types'
import { DOW, monthGridDates, monthOf } from '../../lib/week'
import { TypeIcon } from '../../components/ui/Icon'

const today = () => new Date().toISOString().slice(0, 10)
const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))
const mi = (n: number) => (n % 1 ? n.toFixed(1) : String(n))

const STATUS: Record<WorkoutStatus, { label: string; cls: string }> = {
  done: { label: '✓ Done', cls: 'text-accent' },
  today: { label: '● Today', cls: 'text-text' },
  planned: { label: '● Planned', cls: 'text-text-faint' },
  missed: { label: '● Missed', cls: 'text-missed' },
  rest: { label: 'Rest', cls: 'text-text-faint' },
}

function DayCell({ date, w, inMonth, isToday, isSel, onPick }: {
  date: string; w: Workout | undefined; inMonth: boolean; isToday: boolean; isSel: boolean; onPick: (d: string) => void
}) {
  const day = Number(date.slice(8, 10))
  const isRest = w?.type === 'rest' || w?.status === 'rest'
  const ring = isSel || isToday ? 'ring-2 ring-inset ring-accent' : w?.status === 'done' ? 'ring-1 ring-inset ring-accent/40' : ''
  return (
    <button onClick={() => onPick(date)}
      className={`flex min-h-[92px] flex-col border-b border-r border-line p-2 text-left transition hover:bg-surface2 ${inMonth ? '' : 'opacity-35'} ${ring}`}>
      <div className="flex items-start justify-between">
        <span className={`font-num text-xs ${isToday ? 'font-bold text-accent' : 'text-text-mute'}`}>{day}</span>
        {w && !isRest && <TypeIcon type={w.type} className="h-3.5 w-3.5 text-text-faint" />}
      </div>
      {w && (isRest ? (
        <span className="m-auto text-xs text-text-faint">Rest</span>
      ) : (
        <div className="mt-auto">
          {w.dist != null && <div className="font-num text-sm text-text">{mi(w.dist)} <span className="text-xs text-text-faint">mi</span></div>}
          <div className={`text-[11px] ${STATUS[w.status]?.cls ?? 'text-text-faint'}`}>{STATUS[w.status]?.label}</div>
        </div>
      ))}
    </button>
  )
}

function WeekSummary({ days, isCurrent }: { days: (Workout | null)[]; isCurrent: boolean }) {
  const present = days.filter(Boolean) as Workout[]
  const scheduled = present.reduce((s, w) => s + (w.dist ?? 0), 0)
  const completed = present.filter((w) => w.status === 'done').reduce((s, w) => s + (w.dist ?? 0), 0)
  const pct = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0
  return (
    <div className={`flex flex-col justify-center gap-1.5 border-b border-line p-2 ${isCurrent ? 'ring-2 ring-inset ring-text/40' : ''}`}>
      <div className="font-num text-sm">
        <span className="font-bold text-text">{mi(completed)}</span>
        <span className="text-text-faint"> / {mi(scheduled)} </span>
        <span className="text-xs text-text-faint">mi</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="text-[10px] text-text-faint">{completed > 0 ? `${pct}% complete` : 'Upcoming'}</div>
    </div>
  )
}

export function MonthGrid({ anchor, byDate, selectedDate, onPick }: {
  anchor: string; byDate: Record<string, Workout>; selectedDate: string | null; onPick: (date: string) => void
}) {
  const weeks = chunk(monthGridDates(anchor), 7)
  const m = monthOf(anchor)
  const todayIso = today()
  return (
    <div className="rb-card overflow-hidden p-0">
      <div className="grid grid-cols-8 border-b border-line">
        {DOW.map((d) => <div key={d} className="border-r border-line px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-text-mute">{d}</div>)}
        <div className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-accent">Week mileage</div>
      </div>
      <div className="grid grid-cols-8">
        {weeks.map((week) => (
          <Fragment key={week[0]}>
            {week.map((date) => (
              <DayCell key={date} date={date} w={byDate[date]} inMonth={monthOf(date) === m}
                isToday={date === todayIso} isSel={date === selectedDate} onPick={onPick} />
            ))}
            <WeekSummary days={week.map((d) => byDate[d] ?? null)} isCurrent={week.includes(todayIso)} />
          </Fragment>
        ))}
      </div>
    </div>
  )
}
