import { StarIcon } from '../../components/ui/FormIcons'
import { fmtWhen, hoursSince, reasonLabel } from '../../lib/adminFormat'
import type { AdminReport } from '../../lib/queries/admin'

/** One ticket in the list. Unread: lime dot + full strength. Read: faded.
 *  The star toggles without opening the ticket. */
export function ReportListItem({ report: r, active, onOpen, onStar }: {
  report: AdminReport
  active: boolean
  onOpen: () => void
  onStar: (starred: boolean) => void
}) {
  const unread = !r.read_at
  const overdue = r.status === 'open' && hoursSince(r.created_at) > 24
  return (
    <li className={`group relative rounded-[14px] border transition ${active ? 'border-accent bg-surface2' : 'border-line hover:border-text-mute'} ${!unread && !active ? 'opacity-55 hover:opacity-90' : ''}`}>
      <button type="button" onClick={onOpen} aria-current={active}
        aria-label={`${reasonLabel(r.reason)}, ${r.reported_name ?? 'deleted account'}${unread ? ', unread' : ''}`}
        className="w-full rounded-[14px] py-3 pl-7 pr-10 text-left">
        {unread && <span className="absolute left-3 top-[18px] h-2 w-2 rounded-full bg-accent" aria-hidden="true" />}
        <span className="flex items-center gap-2">
          <span className={`text-sm text-text ${unread ? 'font-bold' : 'font-medium'}`}>{reasonLabel(r.reason)}</span>
          {overdue && <span className="rounded-full bg-missed/15 px-1.5 text-[11px] font-semibold text-missed">Over 24h</span>}
        </span>
        <span className="mt-0.5 block text-xs text-text-mute">
          {r.reported_name ?? 'Deleted account'}<span className="text-text-faint"> reported by </span>{r.reporter_name ?? 'deleted account'}
        </span>
        <span className="block text-xs text-text-faint">{fmtWhen(r.created_at)}</span>
      </button>
      <button type="button" onClick={() => onStar(!r.starred)} aria-pressed={r.starred}
        aria-label={r.starred ? 'Unstar report' : 'Star report'}
        className={`absolute right-2.5 top-2.5 rounded-md p-1 transition ${r.starred ? 'text-accent' : 'text-text-faint opacity-0 hover:text-text group-hover:opacity-100 focus-visible:opacity-100'}`}>
        <StarIcon className="h-4 w-4" filled={r.starred} />
      </button>
    </li>
  )
}
