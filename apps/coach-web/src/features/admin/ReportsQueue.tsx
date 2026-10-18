import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ReportDetail } from './ReportDetail'
import { ReportFilters } from './ReportFilters'
import { ReportListItem } from './ReportListItem'
import { filterSortReports, type ReportFilter, type ReportSort } from '../../lib/adminFormat'
import { useAdminReports, useMarkReport, type ReportStatus } from '../../lib/queries/admin'

const TABS: { status: ReportStatus; label: string }[] = [
  { status: 'open', label: 'Open' },
  { status: 'actioned', label: 'Actioned' },
  { status: 'dismissed', label: 'Dismissed' },
]

/** Reports queue. A frozen toolbar (status, search, filters, CSV) over two
 *  independently scrolling panes: the ticket list and the open ticket.
 *  Everything lives in the URL (?status=&id=&q=…) so views are linkable and
 *  the alert email opens the right ticket. Opening a ticket marks it read. */
export function ReportsQueue() {
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') as ReportStatus) || 'open'
  const selectedId = params.get('id')
  const { data, isLoading, error } = useAdminReports(status)
  const openCount = useAdminReports('open').data?.length
  const mark = useMarkReport()

  const filter: ReportFilter = {
    q: params.get('q') ?? undefined,
    reason: params.get('reason') ?? undefined,
    sort: (params.get('sort') as ReportSort) ?? undefined,
    overdueOnly: status === 'open' && params.get('overdue') === '1',
    starredOnly: params.get('starred') === '1',
    unreadOnly: params.get('unread') === '1',
  }
  const rows = data ? filterSortReports(data, filter) : undefined
  // No auto-open: showing a ticket marks it read, so only open what's chosen.
  const selected = selectedId ? data?.find((r) => r.id === selectedId) ?? null : null

  useEffect(() => {
    if (selected && !selected.read_at) mark.mutate({ reportId: selected.id, read: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the open ticket changes
  }, [selected?.id])

  const update = (fn: (p: URLSearchParams) => void) => {
    const p = new URLSearchParams(params)
    fn(p)
    setParams(p, { replace: true })
  }
  const setFilter = (f: ReportFilter) => update((p) => {
    const put = (k: string, v: string | undefined) => (v ? p.set(k, v) : p.delete(k))
    put('q', f.q || undefined)
    put('reason', f.reason)
    put('sort', f.sort && f.sort !== 'newest' ? f.sort : undefined)
    put('overdue', f.overdueOnly ? '1' : undefined)
    put('starred', f.starredOnly ? '1' : undefined)
    put('unread', f.unreadOnly ? '1' : undefined)
  })

  return (
    <div className="flex flex-col md:min-h-0 md:flex-1">
      {/* Frozen toolbar */}
      <div className="flex shrink-0 items-center gap-2 pb-3">
        <div role="tablist" aria-label="Report status" className="flex h-8 shrink-0 items-center rounded-[10px] bg-surface2 p-0.5">
          {TABS.map((t) => (
            <button key={t.status} role="tab" aria-selected={status === t.status}
              onClick={() => update((p) => { p.set('status', t.status); p.delete('id') })}
              className={`flex h-7 items-center gap-1.5 rounded-[8px] px-3 text-xs font-semibold transition ${status === t.status ? 'bg-accent text-on-accent' : 'text-text-mute hover:text-text'}`}>
              {t.label}
              {t.status === 'open' && openCount !== undefined && openCount > 0 && (
                <span className={`rounded-full px-1.5 text-[10px] ${status === 'open' ? 'bg-on-accent/15' : 'bg-chip text-text'}`}>{openCount}</span>
              )}
            </button>
          ))}
        </div>
        <ReportFilters value={filter} onChange={setFilter} showOverdue={status === 'open'} />
      </div>

      <div className="grid gap-5 pb-6 md:min-h-0 md:flex-1 md:grid-cols-[minmax(280px,360px)_1fr]">
        <div role="region" aria-label="Report list" className="md:min-h-0 md:overflow-y-auto md:pr-1">
          {isLoading && <p className="text-sm text-text-mute">Loading…</p>}
          {error && <p className="text-sm text-missed">Couldn't load reports: {(error as Error).message}</p>}
          {data && data.length === 0 && (
            <p className="rb-card p-6 text-sm text-text-mute">{status === 'open' ? 'No open reports. Nice.' : 'Nothing here yet.'}</p>
          )}
          {data && data.length > 0 && rows?.length === 0 && (
            <div className="rb-card p-6 text-sm text-text-mute">
              No reports match these filters.{' '}
              <button type="button" className="font-semibold text-accent hover:brightness-110"
                onClick={() => setFilter({ sort: filter.sort })}>Clear filters</button>
            </div>
          )}
          {rows && data && rows.length > 0 && rows.length < data.length && (
            <p className="mb-2 text-xs text-text-faint">Showing {rows.length} of {data.length}</p>
          )}
          <ul className="space-y-2" aria-label="Reports">
            {rows?.map((r) => (
              <ReportListItem key={r.id} report={r} active={selected?.id === r.id}
                onOpen={() => update((p) => p.set('id', r.id))}
                onStar={(starred) => mark.mutate({ reportId: r.id, starred })} />
            ))}
          </ul>
        </div>

        <div className="md:min-h-0 md:overflow-y-auto">
          {selected ? <ReportDetail key={selected.id} report={selected} /> : (
            rows && rows.length > 0 && (
              <div className="grid h-full min-h-48 place-items-center rounded-[24px] border border-dashed border-line p-8 text-center text-sm text-text-mute">
                Pick a report to review it. Unread ones have a lime dot.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}
