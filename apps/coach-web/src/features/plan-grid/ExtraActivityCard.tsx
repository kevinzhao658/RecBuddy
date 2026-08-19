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

/** Off-plan activity from a synced provider, rendered with the SAME visual
 *  language as a completed DayCard (done tint + ring, title/icon header,
 *  numeric line, ✓) so extras read as first-class cards on the day — just not
 *  draggable or editable. pace==null means it was a ride. */
export function ExtraActivityCard({ actual }: { actual: Actual }) {
  const { unit } = useUnit()
  const isRide = actual.pace == null
  return (
    <div className="rb-card rb-card-sm flex h-full flex-col bg-[rgba(173,255,47,0.10)] p-2 ring-1 ring-accent/45">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="line-clamp-1 text-[14px] font-semibold leading-tight">{isRide ? 'Extra ride' : 'Extra run'}</div>
        {isRide
          ? <BikeIcon className="mt-0.5 h-4 w-4 shrink-0 text-text-mute" />
          : <RunIcon className="mt-0.5 h-4 w-4 shrink-0 text-text-mute" />}
      </div>
      {actual.dist != null && (
        <div className="font-num text-xs text-text-mute">{fmtDist(actual.dist, unit)} {unit} · {actual.time}</div>
      )}
      <div className="mt-auto flex items-center justify-between pt-1.5">
        <span className="text-sm leading-none text-accent" aria-label="Completed">✓</span>
      </div>
    </div>
  )
}
