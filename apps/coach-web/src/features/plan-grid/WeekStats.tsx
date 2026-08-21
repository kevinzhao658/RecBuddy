import type { Workout, Actual } from '../../lib/types'
import { volumeSplit, type VolumeMode } from '../../lib/volume'
import { fmtDur } from '../../lib/fmtDur'
import { useUnit } from '../../lib/useUnit'
import { fromMiles } from '../../lib/units'
import { ProgressStat } from '../../components/ui/ProgressStat'
import { ModeSelect } from '../../components/ui/ModeSelect'
import { crossSegments } from './crossSegments'

/** Weekly completion against plan, actuals-first. Mileage separates run vs
 *  cross via the shared sport dropdown (rendered only when the week has cross
 *  volume); time on feet stays one combined bar. Mode is CONTROLLED — one
 *  volumeMode in CoachPage drives every gauge surface together. */
export function WeekStats({ week, actuals = {}, extras = [], mode = 'run', onModeChange }: {
  week: Workout[][]; actuals?: Record<string, Actual>; extras?: Actual[]
  mode?: VolumeMode; onModeChange?: (m: VolumeMode) => void
}) {
  const { unit } = useUnit()
  const vol = volumeSplit(week.flat(), actuals, extras)
  const crossMode = mode === 'cross' && vol.hasCross
  const side = crossMode ? vol.cross : vol.run
  const label = vol.hasCross ? (mode === 'cross' ? 'Cross mileage' : 'Run mileage') : 'Weekly mileage'
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {vol.hasCross && onModeChange && <ModeSelect mode={mode} onChange={onModeChange} />}
      <ProgressStat label={label} done={side.done} planned={side.planned}
        doneText={fromMiles(side.done, unit).toFixed(1)}
        plannedText={`${fromMiles(side.planned, unit).toFixed(1)} ${unit}`}
        tint="bg-accent"
        segments={crossMode ? crossSegments(vol.crossDone) : undefined} />
      <ProgressStat label="Time on feet" done={vol.doneMin} planned={vol.plannedMin}
        doneText={fmtDur(vol.doneMin)} plannedText={fmtDur(vol.plannedMin)}
        tint="bg-text-mute" />
    </div>
  )
}
