import { useState, type ReactNode } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'

/** Confirm an admin action. The optional note goes in the audit log (and, for
 *  a suspension, is stored as the reason on the account).
 *  `summary` spells out what will happen; `confirmPhrase` (e.g. REMOVE) must be
 *  typed for irreversible actions. */
export function NoteActionModal({ open, title, description, summary, confirmPhrase, confirmLabel, onConfirm, onClose }: {
  open: boolean
  title: string
  description: string
  summary?: ReactNode
  confirmPhrase?: string
  confirmLabel: string
  onConfirm: (note: string) => Promise<unknown>
  onClose: () => void
}) {
  const [note, setNote] = useState('')
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const phraseOk = !confirmPhrase || typed.trim().toUpperCase() === confirmPhrase

  const close = () => { setNote(''); setTyped(''); setError(null); onClose() }
  const submit = async () => {
    setBusy(true); setError(null)
    try {
      await onConfirm(note.trim())
      close()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={close}>
      <h2 className="font-display text-xl font-extrabold italic uppercase text-text">{title}</h2>
      <p className="mt-2 text-sm text-text-mute">{description}</p>
      {summary && <div className="mt-3">{summary}</div>}
      <label className="mt-4 block text-xs font-semibold text-text-faint" htmlFor="admin-note">
        Note (optional)
      </label>
      <textarea id="admin-note" value={note} onChange={(e) => setNote(e.target.value)} rows={3}
        className="mt-1 w-full rounded-[12px] border border-line bg-surface2 px-3 py-2 text-sm text-text outline-none focus:border-accent" />
      {confirmPhrase && (
        <label className="mt-3 block text-sm text-text">
          Type <strong>{confirmPhrase}</strong> to confirm
          <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label={`Type ${confirmPhrase} to confirm`}
            className="mt-1 block w-40 rounded-[10px] border border-missed/50 bg-surface2 px-2.5 py-1.5 text-sm text-text outline-none focus:border-missed" />
        </label>
      )}
      {error && <p className="mt-2 text-sm text-missed" role="alert">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={close} disabled={busy}>Cancel</Button>
        <Button onClick={submit} disabled={busy || !phraseOk}>{busy ? 'Working…' : confirmLabel}</Button>
      </div>
    </Modal>
  )
}
