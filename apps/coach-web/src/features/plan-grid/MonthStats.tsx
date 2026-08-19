import type { Workout, Actual } from '../../lib/types'
import { monthOf } from '../../lib/week'
import { volumeSplit, type VolumeMode } from '../../lib/volume'
import { fmtDur } from '../../lib/fmtDur'
import { useUnit } from '../../lib/useUnit'
import { fromMiles } from '../../lib/units'
import { ProgressStat } from '../../components/ui/ProgressStat'
import { ModeSelect } from '../../components/ui/ModeSelect'

/** Month completion against plan (in-month days only), actuals-first, run/ride
 *  split — the weekly KPIs summed over the month. `extras` arrives pre-filtered
 *  to the anchor month by the caller. Mode is CONTROLLED and shared with the
 *  month grid, so selecting Ride here swaps the KPI column too. */
export function MonthStats({ byDate, anchor, actuals = {}, extras = [], mode = 'run', onModeChange }: {
  byDate: Record<string, Workout[]>; anchor: string
  actuals?: Record<string, Actual>; extras?: Actual[]
  mode?: VolumeMode; onModeChange?: (m: VolumeMode) => void
}) {
  const { unit } = useUnit()
  const m = monthOf(anchor)
  const ws = Object.values(byDate).flat().filter((w) => monthOf(w.date) === m)
  const vol = volumeSplit(ws, actuals, extras)
  const side = mode === 'ride' && vol.hasRide ? vol.ride : vol.run
  const label = vol.hasRide ? (mode === 'ride' ? 'Ride mileage' : 'Run mileage') : 'Monthly mileage'
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {vol.hasRide && onModeChange && <ModeSelect mode={mode} onChange={onModeChange} />}
      <ProgressStat label={label} done={side.done} planned={side.planned}
        doneText={fromMiles(side.done, unit).toFixed(1)}
        plannedText={`${fromMiles(side.planned, unit).toFixed(1)} ${unit}`}
        tint="bg-accent" />
      <ProgressStat label="Time on feet" done={vol.doneMin} planned={vol.plannedMin}
        doneText={fmtDur(vol.doneMin)} plannedText={fmtDur(vol.plannedMin)}
        tint="bg-text-mute" />
    </div>
  )
}
