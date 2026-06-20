import { useState, useEffect } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { useCreateInvite } from '../../lib/queries/invites'

export function AddAthleteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const create = useCreateInvite()

  // Reset internal state on close so reopening starts fresh (avoids showing a
  // previously-generated code when reopened, incl. when closed via the backdrop).
  useEffect(() => { if (!open) { setCode(null); setName('') } }, [open])

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="mb-3 font-display text-xl font-bold">Add athlete</h3>
      {code ? (
        <div className="flex flex-col gap-3">
          <p className="text-text-mute">Share this invite code with your athlete:</p>
          <code className="rb-surface2 rounded-[10px] p-3 text-center font-num text-3xl tracking-[0.2em] text-accent">{code}</code>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <input aria-label="Athlete name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Athlete name"
            className="rounded-[10px] border border-line bg-surface2 px-3 py-2.5 text-text" />
          <Button disabled={!name || create.isPending} onClick={() => create.mutate(name, { onSuccess: setCode })}>
            {create.isPending ? 'Generating…' : 'Generate invite code'}
          </Button>
        </div>
      )}
    </Modal>
  )
}
