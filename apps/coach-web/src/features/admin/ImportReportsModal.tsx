import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { actionLabel } from '../../lib/adminFormat'
import { planImport, type ImportPlan, type PlannedChange } from '../../lib/reportCsv'
import { applyReportChange, fetchAllReports, useInvalidateAdmin } from '../../lib/queries/admin'

type Result = { line: number; ok: boolean; message?: string }

/** Upload an edited export → validate every row against live data → preview →
 *  apply only the valid rows, one at a time (each re-checked server-side and
 *  audit-logged). Removing users needs a typed confirmation. */
export function ImportReportsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const invalidate = useInvalidateAdmin()
  const [plan, setPlan] = useState<ImportPlan | null>(null)
  const [fileName, setFileName] = useState('')
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [results, setResults] = useState<Result[] | null>(null)

  const valid = plan?.changes.filter((c) => c.problems.length === 0) ?? []
  const invalid = plan?.changes.filter((c) => c.problems.length > 0) ?? []
  const removals = valid.filter((c) => c.action === 'delete_user').length
  const confirmed = removals === 0 || confirmText.trim().toUpperCase() === 'REMOVE'

  const reset = () => { setPlan(null); setFileName(''); setConfirmText(''); setResults(null) }
  const close = () => { reset(); onClose() }

  const onFile = async (file: File | undefined) => {
    if (!file) return
    reset(); setFileName(file.name); setLoading(true)
    try {
      // Validate against LIVE data, not whatever the export saw.
      const [text, live] = await Promise.all([file.text(), fetchAllReports()])
      setPlan(planImport(text, live))
    } catch (e) {
      setPlan({ changes: [], skipped: 0, fileError: e instanceof Error ? e.message : 'Could not read the file.' })
    } finally {
      setLoading(false)
    }
  }

  const apply = async () => {
    setApplying(true)
    const out: Result[] = []
    for (const c of valid) {
      try {
        await applyReportChange({
          reportId: c.reportId, action: c.action, newStatus: c.newStatus, note: c.note,
          messageId: c.report?.message_id, userId: c.report?.reported_user_id,
        })
        out.push({ line: c.line, ok: true })
      } catch (e) {
        out.push({ line: c.line, ok: false, message: e instanceof Error ? e.message : 'Failed' })
      }
      setResults([...out])
    }
    setApplying(false)
    await invalidate()
  }

  const describe = (c: PlannedChange) =>
    [c.action && actionLabel(c.action), c.newStatus && `→ ${c.newStatus}`].filter(Boolean).join(' ')

  return (
    <Modal open={open} onClose={close} wide>
      <h2 className="font-display text-xl font-extrabold italic uppercase text-text">Import report changes</h2>
      <p className="mt-2 text-sm text-text-mute">
        Upload an edited export. Fill <code className="text-text">new_status</code> (open, actioned, dismissed),
        {' '}<code className="text-text">action</code> (delete_message, suspend, unsuspend, delete_user), and a
        {' '}<code className="text-text">note</code> on the rows you want to change. Every row is checked before anything runs.
      </p>

      <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-[12px] border border-line px-4 py-2 text-sm font-semibold text-text hover:border-text-mute">
        <input type="file" accept=".csv,text/csv" className="sr-only" aria-label="Choose CSV file"
          onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = '' }} disabled={applying} />
        Choose CSV…
      </label>
      {fileName && <span className="ml-3 text-sm text-text-mute">{fileName}</span>}
      {loading && <p className="mt-3 text-sm text-text-mute">Checking…</p>}
      {plan?.fileError && <p className="mt-3 text-sm text-missed">{plan.fileError}</p>}

      {plan && !plan.fileError && (
        <>
          <p className="mt-4 text-sm text-text">
            <strong>{valid.length}</strong> ready · <strong className={invalid.length ? 'text-missed' : ''}>{invalid.length}</strong> with problems · {plan.skipped} unchanged rows skipped
          </p>
          {plan.changes.length > 0 && (
            <div className="mt-2 max-h-[45vh] overflow-y-auto rounded-[12px] border border-line">
              <table className="w-full text-left text-sm" aria-label="Import preview">
                <thead className="sticky top-0 bg-surface2 text-xs uppercase tracking-wider text-text-faint">
                  <tr><th className="p-2">Line</th><th className="p-2">User</th><th className="p-2">Change</th><th className="p-2">Note</th><th className="p-2">Check</th></tr>
                </thead>
                <tbody>
                  {plan.changes.map((c) => {
                    const r = results?.find((x) => x.line === c.line)
                    return (
                      <tr key={c.line} className="border-t border-hairline align-top">
                        <td className="p-2 text-text-faint">{c.line}</td>
                        <td className="p-2 text-text">{c.who}</td>
                        <td className={`p-2 ${c.action === 'delete_user' ? 'font-semibold text-missed' : 'text-text'}`}>{describe(c) || '—'}</td>
                        <td className="p-2 text-text-mute">{c.note || '—'}</td>
                        <td className="p-2">
                          {r ? (r.ok ? <span className="text-accent">Applied</span> : <span className="text-missed">Failed: {r.message}</span>)
                            : c.problems.length ? <span className="text-missed">{c.problems.join(' ')}</span>
                            : <span className="text-accent">Ready</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {removals > 0 && !results && (
            <div className="mt-4 rounded-[12px] border border-missed/50 bg-missed/10 p-3">
              <p className="text-sm text-text">
                This import permanently removes <strong>{removals}</strong> user{removals === 1 ? '' : 's'}. Type <strong>REMOVE</strong> to confirm.
              </p>
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="Type REMOVE to confirm"
                className="mt-2 rounded-[10px] border border-line bg-surface2 px-2.5 py-1.5 text-sm text-text outline-none focus:border-accent" />
            </div>
          )}
        </>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <Button variant="ghost" onClick={close} disabled={applying}>{results ? 'Done' : 'Cancel'}</Button>
        {!results && (
          <Button onClick={apply} disabled={applying || valid.length === 0 || !confirmed}>
            {applying ? 'Applying…' : `Apply ${valid.length} change${valid.length === 1 ? '' : 's'}`}
          </Button>
        )}
      </div>
    </Modal>
  )
}
