import { Fragment, type ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { Workout, WorkoutStatus } from '../../lib/types'
import { DOW, monthGridDates, monthOf, todayISO } from '../../lib/week'
import { TypeIcon } from '../../components/ui/Icon'
import { useUnit } from '../../lib/useUnit'
import { fmtDist } from '../../lib/units'
import { estMinutes } from '../../lib/estMinutes'
import { fmtDur } from '../../lib/fmtDur'

const chunk = <T,>(arr: T[], n: number) => Array.from({ length: Math.ceil(arr.length / n) }, (_, i) => arr.slice(i * n, i * n + n))

// 'today' isn't a meaningful persisted status (today is date-driven, shown by the
// ring) — render it as Planned, matching DayCard.
const STATUS: Record<WorkoutStatus, { label: string; cls: string }> = {
  done: { label: '✓ Done', cls: 'text-accent' },
  today: { label: '● Planned', cls: 'text-text-faint' },
  planned: { label: '● Planned', cls: 'text-text-faint' },
  missed: { label: '● Missed', cls: 'text-missed' },
  rest: { label: 'Rest', cls: 'text-text-faint' },
}

function DayCell({ date, ws, inMonth, isToday, isSel, canEdit, onPick }: {
  date: string; ws: Workout[]; inMonth: boolean; isToday: boolean; isSel: boolean; canEdit: boolean; onPick: (d: string) => void
}) {
  const { unit } = useUnit()
  // Droppable target so a library workout can be dragged straight onto the day.
  const drop = useDroppable({ id: date, disabled: !canEdit })
  const day = Number(date.slice(8, 10))
  const w = ws[0]
  const isRest = w?.type === 'rest' || w?.status === 'rest'
  // Green outline is reserved for the current day only; a picked day gets a
  // neutral ring so lime never reads as "today" on the wrong cell.
  const ring = drop.isOver ? 'z-10 ring-2 ring-inset ring-accent' : isToday ? 'ring-2 ring-inset ring-accent' : isSel ? 'ring-2 ring-inset ring-text/40' : ''
  // One tinted icon per workout, up to three, then +N — a quick read of how
  // loaded the day is without opening it.
  const iconWs = ws.filter((x) => x.type !== 'rest' && x.status !== 'rest')
  return (
    <button ref={drop.setNodeRef} onClick={(e) => { e.stopPropagation(); onPick(date) }}
      className={`flex min-h-[92px] flex-col border-b border-r border-line p-2 text-left transition hover:bg-surface2 ${inMonth ? '' : 'opacity-35'} ${ring} ${drop.isOver ? 'bg-accent/10' : ''}`}>
      <div className="flex items-start justify-between">
        <span className={`font-num text-xs ${isToday ? 'font-bold text-accent' : 'text-text-mute'}`}>{day}</span>
        <span className="flex items-center gap-0.5">
          {iconWs.slice(0, 3).map((x) => <TypeIcon key={x.id} type={x.type} className="h-3.5 w-3.5" />)}
          {iconWs.length > 3 && <span className="text-[10px] text-text-faint">+{iconWs.length - 3}</span>}
        </span>
      </div>
      {w && (isRest ? (
        <span className="m-auto text-xs text-text-faint">Rest</span>
      ) : (
        <div className="mt-auto">
          {w.dist != null && <div className="font-num text-sm text-text">{fmtDist(w.dist, unit)} <span className="text-xs text-text-faint">{unit}</span></div>}
          <div className={`text-[11px] ${STATUS[w.status]?.cls ?? 'text-text-faint'}`}>{STATUS[w.status]?.label}</div>
        </div>
      ))}
    </button>
  )
}

// A metric row for the KPI column: "done/total" kept to a single line (never
// wraps, so the calendar row height stays put) over a slim bar with the
// percentage pulled out to the right of the bar.
function KpiBar({ value, pct, tint }: { value: ReactNode; pct: number; tint: string }) {
  return (
    <div>
      <div className="truncate font-num text-[10px] leading-tight tabular-nums">{value}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-black/30">
          <div className={`h-full rounded-full ${tint}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <span className="font-num text-[10px] tabular-nums text-text-faint">{pct}%</span>
      </div>
    </div>
  )
}

function WeekSummary({ days, isCurrent }: { days: Workout[][]; isCurrent: boolean }) {
  const { unit } = useUnit()
  const present = days.flat()
  const isDone = (w: Workout) => w.status === 'done'
  const scheduled = present.reduce((s, w) => s + (w.dist ?? 0), 0)
  const completed = present.filter(isDone).reduce((s, w) => s + (w.dist ?? 0), 0)
  const milePct = scheduled > 0 ? Math.round((completed / scheduled) * 100) : 0
  const plannedMin = present.reduce((s, w) => s + estMinutes(w), 0)
  const doneMin = present.filter(isDone).reduce((s, w) => s + estMinutes(w), 0)
  const timePct = plannedMin > 0 ? Math.round((doneMin / plannedMin) * 100) : 0
  // Floats as its own rounded card (padded cell) so the KPI column reads as
  // separate from the calendar grid rather than merged into it.
  return (
    <div className="p-1.5">
      <div className={`rb-card-sm flex h-full flex-col justify-center gap-2 p-2.5 ${isCurrent ? 'ring-1 ring-text/30' : ''}`}>
        <KpiBar tint="bg-accent" pct={milePct}
          value={<><span className="font-bold text-text">{fmtDist(completed, unit)}</span><span className="text-text-faint">/{fmtDist(scheduled, unit)} {unit}</span></>} />
        <KpiBar tint="bg-text-mute" pct={timePct}
          value={<><span className="font-bold text-text">{fmtDur(doneMin)}</span><span className="text-text-faint">/{fmtDur(plannedMin)}</span></>} />
      </div>
    </div>
  )
}

export function MonthGrid({ anchor, byDate, selectedDate, canEdit = true, onPick }: {
  anchor: string; byDate: Record<string, Workout[]>; selectedDate: string | null; canEdit?: boolean; onPick: (date: string) => void
}) {
  const weeks = chunk(monthGridDates(anchor), 7)
  const m = monthOf(anchor)
  const todayIso = todayISO()
  return (
    <div className="overflow-x-auto"><div className="rb-card min-w-[560px] overflow-hidden p-0">
      <div className="grid grid-cols-8 border-b border-line">
        {DOW.map((d) => <div key={d} className="border-r border-line px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-text-mute">{d}</div>)}
        <div className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-accent">Weekly volume</div>
      </div>
      <div className="grid grid-cols-8">
        {weeks.map((week) => (
          <Fragment key={week[0]}>
            {week.map((date) => (
              <DayCell key={date} date={date} ws={byDate[date] ?? []} inMonth={monthOf(date) === m}
                isToday={date === todayIso} isSel={date === selectedDate} canEdit={canEdit} onPick={onPick} />
            ))}
            <WeekSummary days={week.map((d) => byDate[d] ?? [])} isCurrent={week.includes(todayIso)} />
          </Fragment>
        ))}
      </div>
    </div></div>
  )
}
