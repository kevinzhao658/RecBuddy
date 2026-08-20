import type { Actual } from '../../lib/types'
import { extraTitle } from '../../lib/extraTitle'
import { fmtShortDate, localDayOf } from '../../lib/week'
import { useUnit } from '../../lib/useUnit'
import { fmtDist, fmtPace } from '../../lib/units'

const label = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint'

/** Right-rail panel for an off-plan EXTRA activity (workout_id null): read-only
 *  details of the synced run/ride/swim — distance, avg pace (runs), time, avg
 *  HR. Mirrors WorkoutResults' layout so the two read as siblings. */
export function ExtraActivityPanel({ actual, onClose }: { actual: Actual; onClose: () => void }) {
  const { unit } = useUnit()
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
              <span className="font-num text-lg font-bold">{fmtDist(actual.dist, unit)} {unit}</span>
            </div>
          )}
          {actual.pace && (
            <div className="rb-card rb-card-sm p-3">
              <span className={label}>Avg pace</span>
              <span className="font-num text-lg font-bold">{fmtPace(actual.pace, unit)}</span>
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
