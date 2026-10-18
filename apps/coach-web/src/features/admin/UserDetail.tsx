import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { NoteActionModal } from './NoteActionModal'
import { actionLabel, fmtWhen, reasonLabel } from '../../lib/adminFormat'
import { useAdminAction, useAdminUser, useRemoveLink, useSetHead } from '../../lib/queries/admin'

type Pending =
  | { kind: 'suspend' | 'unsuspend' | 'delete' }
  | { kind: 'remove' | 'head'; coachId: string; athleteId: string; label: string }

const sectionTitle = 'mt-6 text-xs font-semibold uppercase tracking-wider text-text-faint'

/** Everything about one user: status, teams (with dispute tools), blocks,
 *  reports by/against, and past admin actions. */
export function UserDetail({ userId }: { userId: string }) {
  const { data, isLoading, error } = useAdminUser(userId)
  const act = useAdminAction()
  const removeLink = useRemoveLink()
  const setHead = useSetHead()
  const [pending, setPending] = useState<Pending | null>(null)

  if (isLoading) return <p className="text-sm text-text-mute">Loading…</p>
  if (error || !data) return <p className="text-sm text-missed">Couldn't load user: {(error as Error)?.message}</p>
  const p = data.profile

  const modal = (() => {
    if (!pending) return null
    switch (pending.kind) {
      case 'suspend': return {
        title: `Suspend ${p.name}`, confirmLabel: 'Suspend',
        description: 'Signs them out and blocks sign-in and posting until you lift it. Your note is stored as the reason.',
        run: (note: string) => act.mutateAsync({ action: 'suspend', user_id: p.id, note }),
      }
      case 'delete': return {
        title: `Remove ${p.name}`, confirmLabel: 'Remove permanently',
        description: 'Permanently deletes their account and everything it owns — profile, plans, logs, and messages. This cannot be undone. Reports keep their saved message copies.',
        run: (note: string) => act.mutateAsync({ action: 'delete_user', user_id: p.id, note }),
      }
      case 'unsuspend': return {
        title: `Lift suspension for ${p.name}`, confirmLabel: 'Lift suspension',
        description: 'They can sign in and post again.',
        run: (note: string) => act.mutateAsync({ action: 'unsuspend', user_id: p.id, note }),
      }
      case 'remove': return {
        title: 'Remove coach link', confirmLabel: 'Remove',
        description: `Ends ${pending.label}. The coach loses access to the athlete's plan and chat.`,
        run: (note: string) => removeLink.mutateAsync({ coachId: pending.coachId, athleteId: pending.athleteId, note }),
      }
      case 'head': return {
        title: 'Make head coach', confirmLabel: 'Make head coach',
        description: `Makes ${pending.label}. The current head coach becomes a co-coach.`,
        run: (note: string) => setHead.mutateAsync({ coachId: pending.coachId, athleteId: pending.athleteId, note }),
      }
    }
  })()

  return (
    <section className="rb-card p-6" aria-label="User detail">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold italic uppercase text-text">{p.name}</h2>
          <p className="text-sm text-text-mute">{p.email ?? 'no email'} · {[p.is_coach && 'coach', p.is_athlete && 'athlete', p.is_admin && 'admin'].filter(Boolean).join(', ')}</p>
          {p.suspended_at && (
            <p className="mt-1 text-sm font-semibold text-missed">Suspended {fmtWhen(p.suspended_at)}{p.suspended_reason ? ` — ${p.suspended_reason}` : ''}</p>
          )}
        </div>
        <div className="flex gap-2">
          {p.suspended_at
            ? <Button variant="ghost" onClick={() => setPending({ kind: 'unsuspend' })}>Lift suspension</Button>
            : <Button variant="ghost" onClick={() => setPending({ kind: 'suspend' })}>Suspend</Button>}
          {!p.is_admin && (
            <Button variant="ghost" className="border-missed/60! text-missed!" onClick={() => setPending({ kind: 'delete' })}>Remove user</Button>
          )}
        </div>
      </div>

      {data.coaches.length > 0 && <>
        <h3 className={sectionTitle}>Coaches (as athlete)</h3>
        <ul className="mt-2 space-y-1.5">
          {data.coaches.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-[10px] bg-surface2 px-3 py-2 text-sm">
              <span><Link className="font-semibold text-accent" to={`/admin/users?id=${c.id}`}>{c.name}</Link>
                <span className="text-text-mute"> · {c.relationship} · {c.permission}</span></span>
              <span className="flex gap-2">
                {c.relationship !== 'head' && (
                  <button className="text-xs font-semibold text-text-mute hover:text-text" aria-label={`Make ${c.name} head coach`}
                    onClick={() => setPending({ kind: 'head', coachId: c.id, athleteId: p.id, label: `${c.name} the head coach for ${p.name}` })}>Make head</button>
                )}
                <button className="text-xs font-semibold text-missed hover:brightness-110" aria-label={`Remove ${c.name} from ${p.name}`}
                  onClick={() => setPending({ kind: 'remove', coachId: c.id, athleteId: p.id, label: `${c.name}'s link with ${p.name}` })}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      </>}

      {data.athletes.length > 0 && <>
        <h3 className={sectionTitle}>Athletes (as coach)</h3>
        <ul className="mt-2 space-y-1.5">
          {data.athletes.map((a) => (
            <li key={a.id} className="flex items-center justify-between rounded-[10px] bg-surface2 px-3 py-2 text-sm">
              <span><Link className="font-semibold text-accent" to={`/admin/users?id=${a.id}`}>{a.name}</Link>
                <span className="text-text-mute"> · {a.relationship}</span></span>
              <button className="text-xs font-semibold text-missed hover:brightness-110" aria-label={`Remove ${p.name} from ${a.name}`}
                onClick={() => setPending({ kind: 'remove', coachId: p.id, athleteId: a.id, label: `${p.name}'s link with ${a.name}` })}>Remove</button>
            </li>
          ))}
        </ul>
      </>}

      <div className="grid gap-x-6 sm:grid-cols-2">
        <div>
          <h3 className={sectionTitle}>Reports against ({data.reports_against.length})</h3>
          <ReportList rows={data.reports_against} />
        </div>
        <div>
          <h3 className={sectionTitle}>Reports filed ({data.reports_by.length})</h3>
          <ReportList rows={data.reports_by} />
        </div>
        <div>
          <h3 className={sectionTitle}>Blocked ({data.blocked.length})</h3>
          <NameList rows={data.blocked} />
        </div>
        <div>
          <h3 className={sectionTitle}>Blocked by ({data.blocked_by.length})</h3>
          <NameList rows={data.blocked_by} />
        </div>
      </div>

      <h3 className={sectionTitle}>Admin history</h3>
      {data.actions.length === 0 ? <p className="mt-1 text-sm text-text-mute">None.</p> : (
        <ul className="mt-2 space-y-1 text-sm">
          {data.actions.map((a, i) => (
            <li key={i} className="text-text-mute"><span className="text-text">{actionLabel(a.action)}</span> by {a.admin ?? '—'} · {fmtWhen(a.created_at)}{a.note ? ` — ${a.note}` : ''}</li>
          ))}
        </ul>
      )}

      {modal && <NoteActionModal open title={modal.title} description={modal.description}
        confirmLabel={modal.confirmLabel} onConfirm={modal.run} onClose={() => setPending(null)} />}
    </section>
  )
}

function ReportList({ rows }: { rows: { id: string; reason: string; status: string; created_at: string }[] }) {
  if (rows.length === 0) return <p className="mt-1 text-sm text-text-mute">None.</p>
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {rows.map((r) => (
        <li key={r.id}>
          <Link className="text-accent hover:brightness-110" to={`/admin/reports?status=${r.status}&id=${r.id}`}>{reasonLabel(r.reason)}</Link>
          <span className="text-text-mute"> · {r.status} · {fmtWhen(r.created_at)}</span>
        </li>
      ))}
    </ul>
  )
}

function NameList({ rows }: { rows: { id: string; name: string | null; at: string }[] }) {
  if (rows.length === 0) return <p className="mt-1 text-sm text-text-mute">None.</p>
  return (
    <ul className="mt-2 space-y-1 text-sm">
      {rows.map((r) => (
        <li key={r.id}><Link className="text-accent" to={`/admin/users?id=${r.id}`}>{r.name ?? 'Deleted account'}</Link>
          <span className="text-text-mute"> · {fmtWhen(r.at)}</span></li>
      ))}
    </ul>
  )
}
