import type { Actual } from '../../lib/types'
import { useUnit } from '../../lib/useUnit'
import { fmtDist } from '../../lib/units'

function BikeIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" />
      <path d="M15 6h-4l-3 6.5M12 17.5 15 6l3.5 4.5" />
    </svg>
  )
}
function RunIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="13" cy="4.5" r="1.8" /><path d="M6 20.5 9.5 14l3-2-1 6.5M9 8.5 12.5 7l3 3 3 .8" />
    </svg>
  )
}

/** Off-plan activity from a synced provider — shown on the day like a logged
 *  card but tagged as extra. pace==null means it was a ride. */
export function ExtraActivityCard({ actual }: { actual: Actual }) {
  const { unit } = useUnit()
  const isRide = actual.pace == null
  return (
    <div className="rb-card rb-card-sm flex items-center gap-2 border border-line bg-[rgba(173,255,47,0.06)] p-2">
      {isRide ? <BikeIcon className="h-4 w-4 shrink-0 text-accent" /> : <RunIcon className="h-4 w-4 shrink-0 text-accent" />}
      <div className="min-w-0 flex-1">
        <div className="line-clamp-1 text-[13px] font-semibold leading-tight">{isRide ? 'Extra ride' : 'Extra run'}</div>
        {actual.dist != null && (
          <div className="font-num text-xs text-text-mute">{fmtDist(actual.dist, unit)} {unit} · {actual.time}</div>
        )}
      </div>
      <span className="text-sm leading-none text-accent" aria-label="Completed">✓</span>
    </div>
  )
}
