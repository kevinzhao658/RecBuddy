import type { Actual } from '../../lib/types'
import { actualActivity } from '../../lib/volume'
import { extraTitle } from '../../lib/extraTitle'
import { swimMeters } from '../../lib/sportMetrics'
import { SportIcon } from '../../components/ui/Icon'
import { useUnit } from '../../lib/useUnit'
import { fmtDist } from '../../lib/units'

/** Off-plan activity from a synced provider, rendered with the SAME visual
 *  language as a completed DayCard (done tint + ring, title/icon header,
 *  numeric line, ✓) so extras read as first-class cards on the day — not
 *  draggable or editable, but clickable to view details when `onClick` is
 *  wired. */
export function ExtraActivityCard({ actual, onClick }: { actual: Actual; onClick?: () => void }) {
  const { unit } = useUnit()
  const kind = actualActivity(actual)
  const title = extraTitle(actual)
  const body = (
    <>
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="line-clamp-1 text-[14px] font-semibold leading-tight">{title}</div>
        <SportIcon sport={kind} className="mt-0.5 h-4 w-4 shrink-0 text-text-mute" />
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
