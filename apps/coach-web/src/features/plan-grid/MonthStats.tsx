import type { Workout } from '../../lib/types'
import { monthOf } from '../../lib/week'
import { useUnit } from '../../lib/useUnit'
import { fromMiles } from '../../lib/units'
import { estMinutes } from '../../lib/estMinutes'
import { fmtDur } from '../../lib/fmtDur'
import { ProgressStat } from '../../components/ui/ProgressStat'

/** Month completion against plan (in-month days only): mileage (accent) and time
 *  on feet (grey) — the weekly KPIs, summed over the month. */
export function MonthStats({ byDate, anchor }: { byDate: Record<string, Workout[]>; anchor: string }) {
  const { unit } = useUnit()
  const m = monthOf(anchor)
  const ws = Object.values(byDate).flat().filter((w) => monthOf(w.date) === m)
  const isDone = (w: Workout) => w.status === 'done'
  const plannedMi = ws.reduce((s, w) => s + (w.dist ?? 0), 0)
  const doneMi = ws.filter(isDone).reduce((s, w) => s + (w.dist ?? 0), 0)
  const plannedMin = ws.reduce((s, w) => s + estMinutes(w), 0)
  const doneMin = ws.filter(isDone).reduce((s, w) => s + estMinutes(w), 0)
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      <ProgressStat label="Monthly mileage" done={doneMi} planned={plannedMi}
        doneText={fromMiles(doneMi, unit).toFixed(1)}
        plannedText={`${fromMiles(plannedMi, unit).toFixed(1)} ${unit}`}
        tint="bg-accent" />
      <ProgressStat label="Time on feet" done={doneMin} planned={plannedMin}
        doneText={fmtDur(doneMin)} plannedText={fmtDur(plannedMin)}
        tint="bg-text-mute" />
    </div>
  )
}
