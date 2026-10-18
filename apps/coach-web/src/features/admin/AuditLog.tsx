import { Link } from 'react-router-dom'
import { actionLabel, fmtWhen } from '../../lib/adminFormat'
import { useAdminActions } from '../../lib/queries/admin'

/** Every admin action, newest first — who did what, to whom, and why. */
export function AuditLog() {
  const { data, isLoading, error } = useAdminActions()
  if (isLoading) return <p className="text-sm text-text-mute">Loading…</p>
  if (error) return <p className="text-sm text-missed">Couldn't load the audit log: {(error as Error).message}</p>
  if (!data?.length) return <p className="rb-card p-6 text-sm text-text-mute">No admin actions yet.</p>
  return (
    <div className="rb-card overflow-x-auto p-2">
      <table className="w-full text-left text-sm" aria-label="Audit log">
        <thead className="text-xs uppercase tracking-wider text-text-faint">
          <tr><th className="p-3">When</th><th className="p-3">Admin</th><th className="p-3">Action</th><th className="p-3">User</th><th className="p-3">Note</th></tr>
        </thead>
        <tbody>
          {data.map((a) => (
            <tr key={a.id} className="border-t border-hairline">
              <td className="whitespace-nowrap p-3 text-text-mute">{fmtWhen(a.created_at)}</td>
              <td className="p-3 text-text">{a.admin_name ?? '—'}</td>
              <td className="p-3 text-text">
                {actionLabel(a.action)}
                {typeof a.details?.status === 'string' && <span className="text-text-mute"> ({a.details.status})</span>}
                {a.report_id && <Link className="ml-2 text-xs text-accent" to={`/admin/reports?status=${String(a.details?.status ?? 'actioned')}&id=${a.report_id}`}>report</Link>}
              </td>
              <td className="p-3">
                {a.target_user_id
                  ? <Link className="text-accent" to={`/admin/users?id=${a.target_user_id}`}>{a.target_name ?? 'Deleted account'}</Link>
                  : <span className="text-text-mute">{typeof a.details?.name === 'string' ? `${a.details.name} (removed)` : '—'}</span>}
              </td>
              <td className="p-3 text-text-mute">{a.note ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
