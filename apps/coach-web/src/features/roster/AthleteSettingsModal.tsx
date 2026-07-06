import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { ConfirmDialog } from './ConfirmDialog'
import { useRemoveAthlete } from '../../lib/queries/roster'
import { useUpdateAthleteGoal } from '../../lib/queries/plan'
import { useAuth } from '../../auth/AuthProvider'
import type { Plan, Profile } from '../../lib/types'

const RACES: { label: string; dist: string }[] = [
  { label: '5K', dist: '3.1 mi' },
  { label: '10K', dist: '6.2 mi' },
  { label: 'Half Marathon', dist: '13.1 mi' },
  { label: 'Marathon', dist: '26.2 mi' },
]
const field = 'rounded-[10px] border border-line bg-surface2 px-3 py-2.5 text-text placeholder:text-text-faint focus:border-text-mute focus:outline-none'
const eyebrow = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint'

/** Per-athlete settings, opened from the gear next to the athlete's name:
 *  edit the race goal (coach-side update_athlete_goal RPC) and remove the
 *  athlete from the roster. Removal keeps the athlete's plan — they can
 *  attach a new coach with a fresh invite code.
 *  Render conditionally ({open && <AthleteSettingsModal …/>}) — the form seeds
 *  from the plan at mount, so each open starts fresh. */
export function AthleteSettingsModal({ open, onClose, athlete, plan, onRemoved, onSaved }: {
  open: boolean; onClose: () => void; athlete: Profile; plan: Plan | null
  onRemoved: () => void; onSaved: () => void
}) {
  const { session } = useAuth()
  const update = useUpdateAthleteGoal(athlete.id)
  const remove = useRemoveAthlete()
  const [race, setRace] = useState(plan?.goal_race ?? '')
  const [dist, setDist] = useState(plan?.goal_distance ?? '')
  const [date, setDate] = useState(plan?.goal_date ?? '')
  const [time, setTime] = useState(plan?.goal_time ?? '')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = () => update.mutate(
    { goalRace: race, goalDistance: dist, goalDate: date, goalTime: time },
    { onSuccess: () => { onSaved(); onClose() }, onError: (e: any) => setError(e.message) },
  )

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="mb-1 font-display text-xl font-bold">Athlete settings</h3>
      <p className="mb-4 text-sm text-text-mute">{athlete.name}</p>

      <div className="flex flex-col gap-3">
        <div>
          <span className={eyebrow}>Goal race</span>
          <input aria-label="Goal race" value={race} onChange={(e) => setRace(e.target.value)}
            placeholder="Riverside Half Marathon" disabled={!plan} className={`${field} w-full disabled:opacity-50`} />
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <span className={eyebrow}>Distance</span>
            <select aria-label="Goal distance" value={dist} onChange={(e) => setDist(e.target.value)}
              disabled={!plan} className={`${field} w-full disabled:opacity-50`}>
              <option value="">—</option>
              {RACES.map((r) => <option key={r.dist} value={r.dist}>{r.label}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <span className={eyebrow}>Goal date</span>
            <input aria-label="Goal date" type="date" value={date} onChange={(e) => setDate(e.target.value)}
              disabled={!plan} className={`${field} w-full font-num disabled:opacity-50`} />
          </div>
        </div>

        <div>
          <span className={eyebrow}>Goal time <span className="normal-case text-text-faint">(optional)</span></span>
          <input aria-label="Goal time" value={time} onChange={(e) => setTime(e.target.value)}
            placeholder="1:48:00" disabled={!plan} className={`${field} w-full font-num disabled:opacity-50`} />
        </div>

        {!plan && <p className="text-xs text-text-faint">No plan yet — add a workout to their week first, then set the goal.</p>}
        {error && <p className="text-xs text-missed">{error}</p>}

        <Button disabled={!plan || update.isPending} onClick={save}>
          {update.isPending ? 'Saving…' : 'Save changes'}
        </Button>

        {/* Danger zone — removal keeps their plan; they re-attach with a new code */}
        <div className="mt-2 border-t border-line pt-3">
          <button onClick={() => setConfirmOpen(true)}
            className="w-full rounded-[12px] border border-line px-3 py-2 text-sm font-medium text-missed hover:border-missed">
            Remove from roster
          </button>
          <p className="mt-2 text-xs text-text-faint">
            {athlete.name.split(' ')[0]} keeps their training plan and can add a new coach with a fresh invite code.
          </p>
        </div>
      </div>

      <ConfirmDialog open={confirmOpen} title={`Remove ${athlete.name} from your roster?`}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          remove.mutate({ coachId: session!.user.id, athleteId: athlete.id }, { onSuccess: () => { onClose(); onRemoved() } })
        }} />
    </Modal>
  )
}
