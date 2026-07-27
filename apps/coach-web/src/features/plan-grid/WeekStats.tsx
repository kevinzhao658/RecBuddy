import type { Workout } from '../../lib/types'
import { estMinutes } from '../../lib/estMinutes'
import { fmtDur } from '../../lib/fmtDur'
import { useUnit } from '../../lib/useUnit'
import { fromMiles } from '../../lib/units'
import { ProgressStat } from '../../components/ui/ProgressStat'

/** The week's completion against plan: mileage (accent) and time on feet (grey).
 *  "Done" mirrors the month mechanic — the scheduled amount of finished workouts. */
export function WeekStats({ week }: { week: Workout[][] }) {
  const { unit } = useUnit()
  const present = week.flat()
  const isDone = (w: Workout) => w.status === 'done'
  const plannedMi = present.reduce((s, w) => s + (w.dist ?? 0), 0)
  const doneMi = present.filter(isDone).reduce((s, w) => s + (w.dist ?? 0), 0)
  const plannedMin = present.reduce((s, w) => s + estMinutes(w), 0)
  const doneMin = present.filter(isDone).reduce((s, w) => s + estMinutes(w), 0)
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      <ProgressStat label="Weekly mileage" done={doneMi} planned={plannedMi}
        doneText={fromMiles(doneMi, unit).toFixed(1)}
        plannedText={`${fromMiles(plannedMi, unit).toFixed(1)} ${unit}`}
        tint="bg-accent" />
      <ProgressStat label="Time on feet" done={doneMin} planned={plannedMin}
        doneText={fmtDur(doneMin)} plannedText={fmtDur(plannedMin)}
        tint="bg-text-mute" />
    </div>
  )
}
