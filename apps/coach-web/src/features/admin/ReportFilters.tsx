import type { ReactNode } from 'react'
import { Dropdown, MenuGroup, MenuItem } from '../../components/ui/Dropdown'
import { ChevronDownIcon, CloseIcon, FunnelIcon, SearchIcon, SortIcon, StarIcon } from '../../components/ui/FormIcons'
import { REPORT_REASONS, REPORT_SORTS, reasonLabel, type ReportFilter, type ReportSort } from '../../lib/adminFormat'

const SHORT_SORT: Record<ReportSort, string> = { newest: 'Newest', oldest: 'Oldest', most_reported: 'Most reported', reason: 'Reason' }

/** The query bar: search, active filters as removable tokens, then sort and
 *  filter menus — one composed control instead of a stack of inputs. */
export function ReportFilters({ value, onChange, showOverdue }: {
  value: ReportFilter
  onChange: (next: ReportFilter) => void
  showOverdue: boolean
}) {
  const set = (patch: Partial<ReportFilter>) => onChange({ ...value, ...patch })
  const sort = value.sort ?? 'newest'
  const tokens: { key: string; label: ReactNode; clear: () => void }[] = [
    value.reason && { key: 'reason', label: reasonLabel(value.reason), clear: () => set({ reason: undefined }) },
    value.starredOnly && { key: 'starred', label: <><StarIcon className="h-3 w-3" filled />Starred</>, clear: () => set({ starredOnly: undefined }) },
    value.unreadOnly && { key: 'unread', label: 'Unread', clear: () => set({ unreadOnly: undefined }) },
    showOverdue && value.overdueOnly && { key: 'overdue', label: 'Over 24h', clear: () => set({ overdueOnly: undefined }) },
  ].filter(Boolean) as { key: string; label: ReactNode; clear: () => void }[]

  return (
    <div role="search" aria-label="Filter reports"
      className="flex h-9 min-w-0 flex-1 items-center rounded-[12px] border border-line bg-surface2 pl-2.5 pr-1 transition focus-within:border-accent/50">
      <SearchIcon className="h-3.5 w-3.5 shrink-0 text-text-faint" />
      <input type="search" value={value.q ?? ''} onChange={(e) => set({ q: e.target.value })}
        placeholder="Search people, emails, content" aria-label="Search reports"
        className="h-full min-w-[120px] flex-1 bg-transparent px-2 text-[13px] text-text outline-none placeholder:text-text-faint" />

      {tokens.length > 0 && (
        <ul aria-label="Active filters" className="flex shrink-0 items-center gap-1 pr-1.5">
          {tokens.map((t) => (
            <li key={t.key}>
              <button type="button" onClick={t.clear} aria-label={`Remove filter: ${typeof t.label === 'string' ? t.label : t.key}`}
                className="flex h-6 items-center gap-1 rounded-full bg-accent/12 pl-2 pr-1.5 text-[11px] font-semibold text-accent transition hover:bg-accent/20">
                {t.label}<CloseIcon className="h-3 w-3 opacity-70" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <span className="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden="true" />
      <Dropdown label="Sort reports" width="w-48" trigger={(open) => (
        <span className={`flex h-7 items-center gap-1.5 rounded-[9px] px-2 text-xs font-semibold transition hover:bg-chip ${open ? 'bg-chip text-text' : 'text-text-mute'}`}>
          <SortIcon className="h-3.5 w-3.5" />{SHORT_SORT[sort]}<ChevronDownIcon className="h-3 w-3 opacity-60" />
        </span>
      )}>
        {(close) => REPORT_SORTS.map((s) => (
          <MenuItem key={s.value} checked={sort === s.value} onSelect={() => { set({ sort: s.value }); close() }}>{s.label}</MenuItem>
        ))}
      </Dropdown>

      <span className="mx-0.5 h-5 w-px shrink-0 bg-line" aria-hidden="true" />
      <Dropdown label="Filter reports by" width="w-64" trigger={(open) => (
        <span className={`flex h-7 items-center gap-1.5 rounded-[9px] px-2 text-xs font-semibold transition hover:bg-chip ${open || tokens.length ? 'text-text' : 'text-text-mute'} ${open ? 'bg-chip' : ''}`}>
          <FunnelIcon className="h-3.5 w-3.5" />Filter
          {tokens.length > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-on-accent">{tokens.length}</span>}
        </span>
      )}>
        {() => (
          <>
            <MenuGroup title="Reason">
              <MenuItem checked={!value.reason} onSelect={() => set({ reason: undefined })}>Any reason</MenuItem>
              {Object.entries(REPORT_REASONS).map(([k, label]) => (
                <MenuItem key={k} checked={value.reason === k} onSelect={() => set({ reason: k })}>{label}</MenuItem>
              ))}
            </MenuGroup>
            <div className="mx-1 my-1 h-px bg-line" />
            <MenuGroup title="Show only">
              <MenuItem kind="checkbox" checked={Boolean(value.starredOnly)} onSelect={() => set({ starredOnly: !value.starredOnly || undefined })}>Starred</MenuItem>
              <MenuItem kind="checkbox" checked={Boolean(value.unreadOnly)} onSelect={() => set({ unreadOnly: !value.unreadOnly || undefined })}>Unread</MenuItem>
              {showOverdue && (
                <MenuItem kind="checkbox" checked={Boolean(value.overdueOnly)} onSelect={() => set({ overdueOnly: !value.overdueOnly || undefined })}>Open over 24 hours</MenuItem>
              )}
            </MenuGroup>
          </>
        )}
      </Dropdown>
    </div>
  )
}
