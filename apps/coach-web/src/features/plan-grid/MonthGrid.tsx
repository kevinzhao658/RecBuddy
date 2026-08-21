import { Fragment, type ReactNode } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { Workout, WorkoutStatus, Actual } from '../../lib/types'
import { DOW, monthGridDates, monthOf, todayISO } from '../../lib/week'
import { TypeIcon, SportIcon } from '../../components/ui/Icon'
import { useUnit } from '../../lib/useUnit'
import { fmtDist } from '../../lib/units'
import { fmtDur } from '../../lib/fmtDur'
import { volumeSplit, type VolumeMode } from '../../lib/volume'
import { swimMeters } from '../../lib/sportMetrics'
import { SPORT_TEXT, SPORT_TINT } from './crossSegments'

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
// percentage pulled out to the right of the bar. `segments` (fractions of the
// FULL bar) color the fill by allocation — cross time split across sports.
function KpiBar({ value, pct, tint, segments }: {
  value: ReactNode; pct: number; tint: string; segments?: { tint: string; frac: number }[]
}) {
  return (
    <div>
      <div className="truncate font-num text-[10px] leading-tight tabular-nums">{value}</div>
      <div className="mt-0.5 flex items-center gap-1.5">
        <div className="flex h-1 flex-1 overflow-hidden rounded-full bg-black/30">
          {segments && segments.length > 0 ? (
            segments.map((s, i) => (
              <div key={i} className={`h-full ${s.tint}`} style={{ width: `${s.frac * 100}%` }} />
            ))
          ) : (
            <div className={`h-full rounded-full ${tint}`} style={{ width: `${Math.min(100, pct)}%` }} />
          )}
        </div>
        <span className="font-num text-[10px] tabular-nums text-text-faint">{pct}%</span>
      </div>
    </div>
  )
}


function WeekSummary({ days, extras, actuals, mode, isCurrent }: {
  days: Workout[][]; extras: Actual[]; actuals: Record<string, Actual>
  mode: VolumeMode; isCurrent: boolean
}) {
  const { unit } = useUnit()
  const vol = volumeSplit(days.flat(), actuals, extras)
  const crossMode = mode === 'cross'
  const side = crossMode ? vol.cross : vol.run
  const milePct = side.planned > 0 ? Math.round((side.done / side.planned) * 100) : 0
  // Cross mileage has no projection — an icon + total per sport replaces the
  // bar; the time row flips to cross-prescribed minutes and KEEPS its %.
  const sports = crossMode
    ? ([
        { sport: 'ride' as const, dist: vol.crossDone.ride },
        { sport: 'swim' as const, dist: vol.crossDone.swim },
        { sport: 'run' as const, dist: vol.crossDone.run },
      ]).filter((s) => s.dist > 0)
    : []
  const timeDone = crossMode ? vol.crossMin.done : vol.doneMin
  const timePlanned = crossMode ? vol.crossMin.planned : vol.plannedMin
  const timePct = timePlanned > 0 ? Math.round((timeDone / timePlanned) * 100) : 0
  // Cross time keeps its completion % — but the FILL is color-coded by how
  // the logged time was allocated across sports (same tints as the icons).
  const timeSegments = crossMode && timeDone > 0
    ? ([['ride', vol.crossMinBySport.ride], ['swim', vol.crossMinBySport.swim], ['run', vol.crossMinBySport.run]] as const)
        .filter(([, min]) => min > 0)
        .map(([sport, min]) => ({
          tint: SPORT_TINT[sport], frac: (min / timeDone) * (Math.min(100, timePct) / 100),
        }))
    : undefined
  return (
    <div className="p-1.5">
      <div className={`rb-card-sm flex h-full flex-col justify-center gap-2 p-2.5 ${isCurrent ? 'ring-1 ring-text/30' : ''}`}>
        {crossMode ? (
          // All three sports must fit ONE line in the narrow cell: tiny type,
          // hairline gaps, unit dropped for mi values (the icon carries the
          // sport; swims keep a compact meters suffix).
          <div className="flex items-center gap-x-1.5 overflow-hidden font-num text-[9px] leading-tight tabular-nums">
            {sports.length === 0 && <span className="text-text-faint">No cross yet</span>}
            {sports.map(({ sport, dist }) => (
              <span key={sport} className="flex items-center gap-0.5 whitespace-nowrap">
                <SportIcon sport={sport} className={`h-3 w-3 shrink-0 ${SPORT_TEXT[sport]}`} />
                <span className="font-bold text-text">
                  {sport === 'swim' ? swimMeters(dist).replace(' ', '') : fmtDist(dist, unit)}
                </span>
              </span>
            ))}
          </div>
        ) : (
          <KpiBar tint="bg-accent" pct={milePct}
            value={<><span className="font-bold text-text">{fmtDist(side.done, unit)}</span><span className="text-text-faint">/{fmtDist(side.planned, unit)} {unit}</span></>} />
        )}
        <KpiBar tint="bg-text-mute" pct={timePct} segments={timeSegments}
          value={<><span className="font-bold text-text">{fmtDur(timeDone)}</span><span className="text-text-faint">/{fmtDur(timePlanned)}</span></>} />
      </div>
    </div>
  )
}

export function MonthGrid({ anchor, byDate, selectedDate, canEdit = true, actuals = {}, extrasByDate = {}, mode = 'run', onPick }: {
  anchor: string; byDate: Record<string, Workout[]>; selectedDate: string | null; canEdit?: boolean
  actuals?: Record<string, Actual>; extrasByDate?: Record<string, Actual[]>; mode?: VolumeMode
  onPick: (date: string) => void
}) {
  const weeks = chunk(monthGridDates(anchor), 7)
  const m = monthOf(anchor)
  const todayIso = todayISO()
  return (
    <div className="overflow-x-auto"><div className="rb-card min-w-[560px] overflow-hidden p-0">
      <div className="grid grid-cols-8 border-b border-line">
        {DOW.map((d) => <div key={d} className="border-r border-line px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-text-mute">{d}</div>)}
        <div className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-accent">{mode === 'cross' ? 'Weekly cross volume' : 'Weekly volume'}</div>
      </div>
      <div className="grid grid-cols-8">
        {weeks.map((week) => (
          <Fragment key={week[0]}>
            {week.map((date) => (
              <DayCell key={date} date={date} ws={byDate[date] ?? []} inMonth={monthOf(date) === m}
                isToday={date === todayIso} isSel={date === selectedDate} canEdit={canEdit} onPick={onPick} />
            ))}
            <WeekSummary days={week.map((d) => byDate[d] ?? [])}
              extras={week.flatMap((d) => extrasByDate[d] ?? [])}
              actuals={actuals} mode={mode} isCurrent={week.includes(todayIso)} />
          </Fragment>
        ))}
      </div>
    </div></div>
  )
}
