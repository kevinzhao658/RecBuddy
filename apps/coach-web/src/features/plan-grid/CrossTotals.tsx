import type { CrossDoneBySport } from '../../lib/volume'
import { swimMeters } from '../../lib/sportMetrics'
import { SportIcon } from '../../components/ui/Icon'
import { useUnit } from '../../lib/useUnit'
import { fmtDist } from '../../lib/units'
import { SPORT_TEXT } from './crossSegments'

/** Cross mileage as an icon + total per sport (swims in meters) — no bar:
 *  distance proportions across sports are misleading (a hard 1,500 m swim is
 *  a sliver next to a bike ride), so the numbers stand alone. */
export function CrossTotals({ crossDone }: { crossDone: CrossDoneBySport }) {
  const { unit } = useUnit()
  const sports = ([
    { sport: 'ride' as const, label: 'Bike', dist: crossDone.ride },
    { sport: 'swim' as const, label: 'Swim', dist: crossDone.swim },
    { sport: 'run' as const, label: 'Run', dist: crossDone.run },
  ]).filter((s) => s.dist > 0)
  return (
    <div className="min-w-[148px]">
      <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-text-mute">Cross mileage</span>
      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-num text-sm tabular-nums">
        {sports.length === 0 && <span className="text-text-faint">No cross logged yet</span>}
        {sports.map(({ sport, label, dist }) => (
          <span key={sport} aria-label={`${label} distance`} className="flex items-center gap-1">
            <SportIcon sport={sport} className={`h-4 w-4 ${SPORT_TEXT[sport]}`} />
            <span className="font-semibold text-text">
              {sport === 'swim' ? swimMeters(dist) : `${fmtDist(dist, unit)} ${unit}`}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
