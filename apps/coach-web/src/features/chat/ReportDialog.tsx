import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { REPORT_REASONS, blockUser, reportContent, type ReportReason } from '../../lib/queries/moderation'
import { supabase } from '../../lib/supabase'

export type ReportTarget = { userId: string; userName: string; messageId?: string }

/** Report a message (or person), optionally blocking them in the same step. */
export function ReportDialog({ open, target, onClose, onDone }: {
  open: boolean; target: ReportTarget; onClose: () => void
  /** Called after a successful report; true when they were also blocked. */
  onDone?: (blocked: boolean) => void
}) {
  const qc = useQueryClient()
  const [reason, setReason] = useState<ReportReason | null>(null)
  const [details, setDetails] = useState('')
  const [alsoBlock, setAlsoBlock] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reported, setReported] = useState(false)   // a retry after a failed block won't re-file
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!reason) return
    setBusy(true); setError(null)
    try {
      if (!reported) {
        await reportContent(supabase, { reason, messageId: target.messageId, userId: target.userId, details })
        setReported(true)
      }
      if (alsoBlock) {
        await blockUser(supabase, target.userId)
        qc.invalidateQueries({ queryKey: ['conversations'] })
        qc.invalidateQueries({ queryKey: ['blocked'] })
      }
      setDone(true)
      onDone?.(alsoBlock)
    } catch {
      setError("Couldn't send the report. Try again, or email support@recbuddy.app.")
    } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose}>
      {done ? (
        <div className="space-y-3 text-center">
          <p className="font-display text-lg font-bold">Thanks for reporting</p>
          <p className="text-sm text-text-mute">
            {alsoBlock ? `${target.userName} is blocked. ` : ''}We'll review your report within 24 hours.
          </p>
          <Button onClick={onClose} className="w-full">Done</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-display text-lg font-bold">{target.messageId ? 'Report message' : `Report ${target.userName}`}</p>
          <p className="text-xs text-text-mute">
            Reports are private: {target.userName} won't know you reported them. We review every report within 24 hours.
          </p>
          <fieldset className="space-y-1">
            {REPORT_REASONS.map((r) => (
              <label key={r.reason} className="flex items-center gap-2 rounded-[10px] px-2 py-1.5 text-sm text-text hover:bg-surface2">
                <input type="radio" name="reason" checked={reason === r.reason} onChange={() => setReason(r.reason)} aria-label={r.label} />
                {r.label}
              </label>
            ))}
          </fieldset>
          <textarea aria-label="Details (optional)" placeholder="Details (optional)" rows={2} value={details} onChange={(e) => setDetails(e.target.value)}
            className="w-full resize-none rounded-[10px] border border-line bg-surface2 px-3 py-2 text-sm text-text outline-none" />
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={alsoBlock} onChange={(e) => setAlsoBlock(e.target.checked)} aria-label={`Also block ${target.userName}`} />
            Also block {target.userName}
          </label>
          {error && <p className="text-xs text-missed">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={submit} disabled={!reason || busy}>Submit report</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
