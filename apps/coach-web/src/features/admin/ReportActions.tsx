import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { NoteActionModal } from './NoteActionModal'
import { actionLabel } from '../../lib/adminFormat'
import { useAdminAction, useResolveReport, type AdminReport } from '../../lib/queries/admin'

type Choice = 'delete_message' | 'suspend' | 'unsuspend' | 'delete_user'

/** Run order: remove the evidence, then restrict the account, then (if chosen)
 *  delete the account. The report closes as actioned only after all succeed. */
const ORDER: Choice[] = ['delete_message', 'suspend', 'unsuspend', 'delete_user']

const STEP_TEXT: Record<Choice, (who: string) => string> = {
  delete_message: () => 'Delete the reported message (and photo) for everyone',
  suspend: (who) => `Suspend ${who}: signed out, can't sign in or post`,
  unsuspend: (who) => `Lift ${who}'s suspension`,
  delete_user: (who) => `Permanently remove ${who}'s account and everything it owns`,
}

/** Open report: pick actions as bubbles, then "Mark actioned" submits them
 *  after a confirmation. Closed report: only Reopen. */
export function ReportActions({ report }: { report: AdminReport }) {
  const act = useAdminAction()
  const resolve = useResolveReport()
  const [picked, setPicked] = useState<Set<Choice>>(new Set())
  const [confirm, setConfirm] = useState<'action' | 'dismiss' | 'reopen' | null>(null)
  const who = report.reported_name ?? 'this user'
  const suspended = Boolean(report.reported_suspended_at)

  // What's possible right now (a retry after a partial failure drops done steps).
  type Option = { id: Choice; label: string; danger?: boolean }
  const available: Option[] = []
  if (report.message_id) available.push({ id: 'delete_message', label: 'Delete message' })
  if (report.reported_user_id) {
    available.push(suspended ? { id: 'unsuspend', label: 'Lift suspension' } : { id: 'suspend', label: 'Suspend user' })
    available.push({ id: 'delete_user', label: 'Remove user', danger: true })
  }
  const chosen = ORDER.filter((c) => picked.has(c) && available.some((a) => a.id === c))

  const toggle = (id: Choice) => setPicked((prev) => {
    const next = new Set(prev)
    if (next.has(id)) { next.delete(id); return next }
    next.add(id)
    // Removing an account makes a suspension moot (and vice versa).
    if (id === 'delete_user') { next.delete('suspend'); next.delete('unsuspend') }
    if (id === 'suspend' || id === 'unsuspend') next.delete('delete_user')
    return next
  })

  const runActions = async (note: string) => {
    for (const step of chosen) {
      try {
        if (step === 'delete_message') {
          await act.mutateAsync({ action: 'delete_message', message_id: report.message_id!, report_id: report.id, note })
        } else {
          await act.mutateAsync({ action: step, user_id: report.reported_user_id!, report_id: report.id, note })
        }
      } catch (e) {
        throw new Error(`${actionLabel(step)} failed: ${e instanceof Error ? e.message : 'unknown error'}. Steps before it were saved; the report is still open.`, { cause: e })
      }
    }
    await resolve.mutateAsync({ reportId: report.id, status: 'actioned', note })
    setPicked(new Set())
  }

  if (report.status !== 'open') {
    return (
      <div className="mt-6">
        <Button variant="ghost" onClick={() => setConfirm('reopen')}>Reopen</Button>
        <NoteActionModal open={confirm === 'reopen'} title="Reopen report" confirmLabel="Reopen"
          description="Moves the report back to the open queue so it can be reviewed again."
          onConfirm={(note) => resolve.mutateAsync({ reportId: report.id, status: 'open', note })}
          onClose={() => setConfirm(null)} />
      </div>
    )
  }

  return (
    <div className="mt-6">
      <p id="action-picker-label" className="text-xs font-semibold text-text-faint">Choose what to do</p>
      <div role="group" aria-labelledby="action-picker-label" className="mt-2 flex flex-wrap gap-2">
        {available.map((a) => {
          const on = picked.has(a.id)
          const tone = a.danger
            ? on ? 'border-missed bg-missed/15 text-missed' : 'border-missed/40 text-missed/85 hover:border-missed'
            : on ? 'border-accent bg-accent/12 text-accent' : 'border-line text-text-mute hover:border-text-mute hover:text-text'
          return (
            <button key={a.id} type="button" aria-pressed={on} onClick={() => toggle(a.id)}
              className={`flex h-9 items-center gap-2 rounded-full border pl-2.5 pr-4 text-sm font-semibold transition ${tone}`}>
              {/* Marker: empty ring when off, filled circle when on. */}
              <span aria-hidden="true"
                className={`h-4 w-4 shrink-0 rounded-full border-[1.5px] border-current transition ${on ? 'bg-current' : 'opacity-60'}`} />
              {a.label}
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={() => setConfirm('action')} disabled={chosen.length === 0}
          className="disabled:bg-chip disabled:text-text-faint disabled:[box-shadow:none]!">
          Mark actioned
        </Button>
        <button type="button" onClick={() => setConfirm('dismiss')}
          className="text-sm font-semibold text-text-mute hover:text-text">Dismiss, no violation</button>
      </div>
      {chosen.length === 0 && (
        <p className="mt-2 text-xs text-text-faint">Pick at least one action to mark this report actioned.</p>
      )}

      <NoteActionModal open={confirm === 'action'} title="Confirm actions" confirmLabel="Confirm and mark actioned"
        description={`This will happen in order, then the report closes as actioned:`}
        summary={
          <ol className="space-y-1.5 text-sm">
            {chosen.map((c, i) => (
              <li key={c} className={`flex gap-2 ${c === 'delete_user' ? 'text-missed' : 'text-text'}`}>
                <span className="text-text-faint">{i + 1}.</span>{STEP_TEXT[c](who)}
              </li>
            ))}
            {chosen.includes('delete_user') && (
              <li className="pl-5 text-xs text-text-faint">Removal can't be undone. The report keeps its saved copy of the message.</li>
            )}
          </ol>
        }
        confirmPhrase={chosen.includes('delete_user') ? 'REMOVE' : undefined}
        onConfirm={runActions} onClose={() => setConfirm(null)} />

      <NoteActionModal open={confirm === 'dismiss'} title="Dismiss report" confirmLabel="Dismiss"
        description="No violation found. The report closes without any action against the user."
        onConfirm={(note) => resolve.mutateAsync({ reportId: report.id, status: 'dismissed', note })}
        onClose={() => setConfirm(null)} />
    </div>
  )
}
