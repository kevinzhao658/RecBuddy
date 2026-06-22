import { useState, useEffect } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { useCreateInvite } from '../../lib/queries/invites'

const RACES: { label: string; dist: string }[] = [
  { label: '5K', dist: '3.1 mi' },
  { label: '10K', dist: '6.2 mi' },
  { label: 'Half Marathon', dist: '13.1 mi' },
  { label: 'Marathon', dist: '26.2 mi' },
]
const field = 'rounded-[10px] border border-line bg-surface2 px-3 py-2.5 text-text placeholder:text-text-faint focus:border-text-mute focus:outline-none'
const eyebrow = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint'

export function AddAthleteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('')
  const [race, setRace] = useState('')
  const [dist, setDist] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [code, setCode] = useState<string | null>(null)
  const create = useCreateInvite()

  // Reset internal state on close so reopening starts fresh (avoids showing a
  // previously-generated code when reopened, incl. when closed via the backdrop).
  useEffect(() => {
    if (!open) { setCode(null); setName(''); setRace(''); setDist(''); setDate(''); setTime('') }
  }, [open])

  const submit = () => create.mutate(
    { athleteName: name, goalRace: race, goalDistance: dist, goalDate: date, goalTime: time },
    { onSuccess: setCode },
  )

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="mb-1 font-display text-xl font-bold">Add athlete</h3>
      {code ? (
        <div className="flex flex-col gap-3">
          <p className="text-text-mute">Share this invite code with {name || 'your athlete'}:</p>
          <code className="rb-surface2 rounded-[10px] p-3 text-center font-num text-3xl tracking-[0.2em] text-accent">{code}</code>
          <p className="text-xs text-text-faint">They’ll redeem it in the RecBuddy app — their goal{race ? ` (${race})` : ''} is prefilled into a fresh plan.</p>
          <Button onClick={onClose}>Done</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="mb-1 text-sm text-text-mute">Set their goal race now and it’s waiting the moment they join.</p>

          <div>
            <span className={eyebrow}>Athlete name</span>
            <input aria-label="Athlete name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Lee" className={`${field} w-full`} />
          </div>

          <div>
            <span className={eyebrow}>Goal race <span className="normal-case text-text-faint">(optional)</span></span>
            <input aria-label="Goal race" value={race} onChange={(e) => setRace(e.target.value)} placeholder="Riverside Half Marathon" className={`${field} w-full`} />
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <span className={eyebrow}>Distance</span>
              <select aria-label="Goal distance" value={dist} onChange={(e) => setDist(e.target.value)} className={`${field} w-full`}>
                <option value="">—</option>
                {RACES.map((r) => <option key={r.dist} value={r.dist}>{r.label}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <span className={eyebrow}>Goal date</span>
              <input aria-label="Goal date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={`${field} w-full font-num`} />
            </div>
          </div>

          <div>
            <span className={eyebrow}>Goal time <span className="normal-case text-text-faint">(optional)</span></span>
            <input aria-label="Goal time" value={time} onChange={(e) => setTime(e.target.value)} placeholder="1:48:00" className={`${field} w-full font-num`} />
          </div>

          <Button disabled={!name || create.isPending} onClick={submit}>
            {create.isPending ? 'Generating…' : 'Generate invite code'}
          </Button>
        </div>
      )}
    </Modal>
  )
}
