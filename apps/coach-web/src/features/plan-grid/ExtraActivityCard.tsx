import type { Actual } from '../../lib/types'
import { actualActivity } from '../../lib/volume'
import { extraTitle } from '../../lib/extraTitle'
import { swimMeters } from '../../lib/sportMetrics'
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
function SwimIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="15.5" cy="6.5" r="1.8" /><path d="M4 11.5 9 9l4 3.5-3 2" />
      <path d="M3 18c1.5-1.2 3-1.2 4.5 0s3 1.2 4.5 0 3-1.2 4.5 0 3 1.2 4.5 0" />
    </svg>
  )
}

/** Off-plan activity from a synced provider, rendered with the SAME visual
 *  language as a completed DayCard (done tint + ring, title/icon header,
 *  numeric line, ✓) so extras read as first-class cards on the day — not
 *  draggable or editable, but clickable to view details when `onClick` is
 *  wired. */
export function ExtraActivityCard({ actual, onClick }: { actual: Actual; onClick?: () => void }) {
  const { unit } = useUnit()
  const kind = actualActivity(actual)
  const title = extraTitle(actual)
  const iconCls = 'mt-0.5 h-4 w-4 shrink-0 text-text-mute'
  const body = (
    <>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="line-clamp-1 text-[14px] font-semibold leading-tight">{title}</div>
        {kind === 'ride' ? <BikeIcon className={iconCls} />
          : kind === 'swim' ? <SwimIcon className={iconCls} />
          : <RunIcon className={iconCls} />}
      </div>
      {actual.dist != null && (
        <div className="font-num text-xs text-text-mute">
          {kind === 'swim' ? swimMeters(actual.dist) : `${fmtDist(actual.dist, unit)} ${unit}`} · {actual.time}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between pt-1.5">
        <span className="text-sm leading-none text-accent" aria-label="Completed">✓</span>
      </div>
    </>
  )
  const cls = 'rb-card rb-card-sm flex h-full w-full flex-col bg-[rgba(173,255,47,0.10)] p-2 text-left ring-1 ring-accent/45'
  if (!onClick) return <div className={cls}>{body}</div>
  return (
    <button type="button" aria-label={`View ${title.toLowerCase()} details`}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`${cls} cursor-pointer transition hover:brightness-110`}>
      {body}
    </button>
  )
}
