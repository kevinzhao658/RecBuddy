import type { Actual } from '../../lib/types'
import { extraTitle } from '../../lib/extraTitle'
import { actualActivity } from '../../lib/volume'
import { avgSpeed, swimPace100, swimMeters } from '../../lib/sportMetrics'
import { fmtShortDate, localDayOf } from '../../lib/week'
import { useUnit } from '../../lib/useUnit'
import { fmtDist, fmtPace } from '../../lib/units'

const label = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint'

/** Right-rail panel for an off-plan EXTRA activity (workout_id null): read-only
 *  details of the synced run/ride/swim — distance, avg pace (runs), time, avg
 *  HR. Mirrors WorkoutResults' layout so the two read as siblings. */
export function ExtraActivityPanel({ actual, onClose }: { actual: Actual; onClose: () => void }) {
  const { unit } = useUnit()
  const sport = actualActivity(actual)
  const speed = sport === 'ride' ? avgSpeed(actual.dist, actual.time, unit) : null
  const per100 = sport === 'swim' ? swimPace100(actual.dist, actual.time) : null
  return (
    <aside className="rb-surface flex h-full w-80 shrink-0 flex-col border-l border-line">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">Extra activity</p>
          <p className="font-display text-lg font-bold tracking-tight text-text">
            {fmtShortDate(localDayOf(actual.recorded_at))} · {extraTitle(actual)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {actual.dist != null && (
            <div className="rb-card rb-card-sm p-3">
              <span className={label}>Distance</span>
              <span className="font-num text-lg font-bold">
                {sport === 'swim' ? swimMeters(actual.dist) : `${fmtDist(actual.dist, unit)} ${unit}`}
              </span>
            </div>
          )}
          {sport === 'run' && actual.pace && (
            <div className="rb-card rb-card-sm p-3">
              <span className={label}>Avg pace</span>
              <span className="font-num text-lg font-bold">{fmtPace(actual.pace, unit)}</span>
            </div>
          )}
          {speed && (
            <div className="rb-card rb-card-sm p-3">
              <span className={label}>Avg speed</span>
              <span className="font-num text-lg font-bold">{speed}</span>
            </div>
          )}
          {per100 && (
            <div className="rb-card rb-card-sm p-3">
              <span className={label}>Pace /100m</span>
              <span className="font-num text-lg font-bold">{per100.replace(' /100m', '')}</span>
            </div>
          )}
          {sport === 'ride' && actual.avg_watts != null && (
            <div className="rb-card rb-card-sm p-3">
              <span className={label}>Avg power</span>
              <span className="font-num text-lg font-bold">{actual.avg_watts} W</span>
            </div>
          )}
          {actual.time && (
            <div className="rb-card rb-card-sm p-3">
              <span className={label}>Time</span>
              <span className="font-num text-lg font-bold">{actual.time}</span>
            </div>
          )}
          {actual.hr != null && (
            <div className="rb-card rb-card-sm p-3">
              <span className={label}>Avg HR</span>
              <span className="font-num text-lg font-bold">{actual.hr}</span>
            </div>
          )}
        </div>

        <p className="text-xs text-text-faint">Off-plan activity — not attached to a prescribed workout · Source: {actual.source}</p>
      </div>

      <div className="border-t border-line p-4">
        <button onClick={onClose} className="w-full rounded-[12px] border border-line px-5 py-2.5 text-sm font-semibold text-text-mute transition hover:border-text-mute hover:text-text">Close</button>
      </div>
    </aside>
  )
}
