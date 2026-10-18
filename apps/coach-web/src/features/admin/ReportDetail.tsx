import { useState } from 'react'
import { Link } from 'react-router-dom'
import { StarIcon } from '../../components/ui/FormIcons'
import { ReportActions } from './ReportActions'
import { actionLabel, describeMessage, fmtWhen, hoursSince, reasonLabel } from '../../lib/adminFormat'
import {
  useMarkReport, useReportContext, type AdminReport,
} from '../../lib/queries/admin'

/** One report: who, what, the surrounding conversation, and the actions. */
export function ReportDetail({ report }: { report: AdminReport }) {
  const context = useReportContext(report.id)
  const mark = useMarkReport()
  const [showConversation, setShowConversation] = useState(false)
  const acted = report.actions_taken.length > 0
  const overdue = report.status === 'open' && hoursSince(report.created_at) > 24
  const suspended = Boolean(report.reported_suspended_at)

  return (
    <section className="rb-card p-6" aria-label="Report detail">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-display text-2xl font-extrabold italic uppercase text-text">{reasonLabel(report.reason)}</h2>
        <span className="rounded-full bg-chip px-2.5 py-0.5 text-xs font-semibold uppercase text-text-mute">{report.status}</span>
        {overdue && <span className="rounded-full bg-missed/20 px-2.5 py-0.5 text-xs font-semibold text-missed">Over 24h</span>}
        <div className="ml-auto flex items-center gap-1">
          <button type="button" onClick={() => mark.mutate({ reportId: report.id, read: false })}
            className="rounded-md px-2 py-1 text-xs font-semibold text-text-mute hover:bg-chip hover:text-text">Mark unread</button>
          <button type="button" onClick={() => mark.mutate({ reportId: report.id, starred: !report.starred })}
            aria-pressed={report.starred} aria-label={report.starred ? 'Unstar report' : 'Star report'}
            className={`rounded-md p-1.5 hover:bg-chip ${report.starred ? 'text-accent' : 'text-text-mute hover:text-text'}`}>
            <StarIcon className="h-4 w-4" filled={report.starred} />
          </button>
        </div>
      </div>
      <p className="mt-1 text-xs text-text-faint">Reported {fmtWhen(report.created_at)} · ID {report.id}</p>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-text-faint">Report details</h3>
      <dl className="mt-2 grid grid-cols-[140px_1fr] gap-y-2 text-sm">
        <dt className="text-text-faint">Reported user</dt>
        <dd className="text-text">
          {report.reported_user_id
            ? <Link className="font-semibold text-accent hover:brightness-110" to={`/admin/users?id=${report.reported_user_id}`}>{report.reported_name}</Link>
            : 'Deleted account'}
          {report.reported_email && <span className="text-text-mute"> · {report.reported_email}</span>}
          {suspended && <span className="ml-2 text-xs font-semibold text-missed">SUSPENDED</span>}
          {report.reported_open_reports > 1 && <span className="ml-2 text-xs text-text-mute">{report.reported_open_reports} open reports</span>}
        </dd>
        <dt className="text-text-faint">Reported by</dt>
        <dd className="text-text">
          {report.reporter_id
            ? <Link className="font-semibold text-accent hover:brightness-110" to={`/admin/users?id=${report.reporter_id}`}>{report.reporter_name}</Link>
            : 'Deleted account'}
          {report.reporter_email && <span className="text-text-mute"> · {report.reporter_email}</span>}
        </dd>
        <dt className="text-text-faint">Their note</dt>
        <dd className="text-text">{report.details ?? '—'}</dd>
        {report.status !== 'open' && report.resolution_note && <>
          <dt className="text-text-faint">Resolution</dt>
          <dd className="text-text">{report.resolution_note} <span className="text-text-mute">({fmtWhen(report.resolved_at)})</span></dd>
        </>}
      </dl>

      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wider text-text-faint">Reported content</h3>
      <blockquote className="mt-2 whitespace-pre-wrap rounded-[12px] border-l-4 border-missed bg-surface2 px-4 py-3 text-sm text-text">
        {describeMessage(report.content_snapshot)}
      </blockquote>
      {report.content_snapshot && !report.message_id && <p className="mt-1 text-xs text-text-faint">The message has been deleted — this is the saved copy.</p>}

      {report.content_snapshot && <>
        <button type="button" onClick={() => setShowConversation((v) => !v)} aria-expanded={showConversation}
          aria-controls="report-conversation"
          className="mt-6 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-text-faint hover:text-text">
          <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition ${showConversation ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="M9 6l6 6-6 6" /></svg>
          Conversation{context.data ? ` (${context.data.length} messages)` : ''}
        </button>
        {showConversation && (
          <ol id="report-conversation" className="mt-2 max-h-80 space-y-1.5 overflow-y-auto pr-1" aria-label="Conversation context">
            {context.isLoading && <li className="text-sm text-text-mute">Loading…</li>}
            {context.data?.map((m) => (
              <li key={m.id} className={`rounded-[10px] px-3 py-2 text-sm ${m.is_reported ? 'bg-missed/15 ring-1 ring-missed/50' : 'bg-surface2'}`}>
                <span className="font-semibold text-text">{m.sender_name ?? 'Unknown'}</span>
                <span className="ml-2 text-xs text-text-faint">{fmtWhen(m.created_at)}</span>
                <p className="text-text-mute">{describeMessage(m)}</p>
              </li>
            ))}
          </ol>
        )}
      </>}

      {acted && (
        <p className="mt-6 text-sm text-text-mute">
          <span className="text-xs font-semibold uppercase tracking-wider text-text-faint">Actions taken </span>
          {report.actions_taken.map(actionLabel).join(' · ')}
        </p>
      )}

      <ReportActions report={report} />
    </section>
  )
}
