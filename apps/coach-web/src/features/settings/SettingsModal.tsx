import { useEffect, useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'
import { useMe, useUpdateProfile } from '../../lib/queries/me'
import { useUnit } from '../../lib/useUnit'
import type { CoachTitle } from '../../lib/types'

const TITLES: CoachTitle[] = ['Head Coach', 'Assistant Coach', 'Strength Coach', 'Physio']
const field = 'w-full rounded-[10px] border border-line bg-surface2 px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-text-mute focus:outline-none'
const label = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint'
const eyebrow = 'mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-accent'

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe()
  const updateProfile = useUpdateProfile()
  const { unit, setUnit } = useUnit()

  const [name, setName] = useState('')
  const [title, setTitle] = useState<CoachTitle>('Head Coach')
  const [email, setEmail] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Seed fields from the loaded profile each time the modal opens.
  useEffect(() => {
    if (open && me.data) {
      setName(me.data.name); setTitle((me.data.title as CoachTitle) ?? 'Head Coach')
      setEmail(me.data.email); setOldPassword(''); setPassword(''); setMsg(null)
    }
  }, [open, me.data])

  const flash = (ok: boolean, text: string) => setMsg({ ok, text })

  const saveProfile = () =>
    updateProfile.mutate({ name: name.trim(), title }, {
      onSuccess: () => flash(true, 'Profile updated.'),
      onError: (e: any) => flash(false, e.message),
    })

  const changeEmail = async () => {
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ email: email.trim() })
    setBusy(false)
    flash(!error, error ? error.message : `Confirmation sent to ${email.trim()} — click the link to finish.`)
  }

  const changePassword = async () => {
    if (!oldPassword) return flash(false, 'Enter your current password.')
    if (password.length < 6) return flash(false, 'New password must be at least 6 characters.')
    setBusy(true)
    // Verify the current password by re-authenticating before changing it.
    const { error: vErr } = await supabase.auth.signInWithPassword({ email: me.data?.email ?? '', password: oldPassword })
    if (vErr) { setBusy(false); return flash(false, 'Current password is incorrect.') }
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) flash(false, error.message)
    else { setOldPassword(''); setPassword(''); flash(true, 'Password updated.') }
  }

  return (
    <Modal open={open} onClose={onClose}>
      <h3 className="mb-4 font-display text-xl font-bold">Settings</h3>
      <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto pr-1">
        {/* Profile */}
        <section>
          <p className={eyebrow}>Profile</p>
          <span className={label}>Name</span>
          <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} className={field} />
          <span className={`${label} mt-3`}>Coaching title</span>
          <div className="flex flex-wrap gap-1.5">
            {TITLES.map((t) => (
              <button key={t} onClick={() => setTitle(t)}
                className={`rounded-[9px] border px-2.5 py-1 text-xs font-medium transition ${title === t ? 'border-accent bg-surface2 text-accent' : 'border-line text-text-mute hover:border-text-mute'}`}>{t}</button>
            ))}
          </div>
          <Button variant="ghost" onClick={saveProfile} disabled={updateProfile.isPending || !name.trim()} className="mt-3">Save profile</Button>
        </section>

        {/* Units */}
        <section>
          <p className={eyebrow}>Units</p>
          <div className="inline-flex rounded-[10px] bg-surface2 p-1">
            {(['mi', 'km'] as const).map((u) => (
              <button key={u} onClick={() => setUnit(u)}
                className={`rounded-[8px] px-4 py-1.5 text-sm transition ${unit === u ? 'bg-surface font-semibold text-text shadow-sm' : 'font-medium text-text-faint hover:text-text'}`}>
                {u === 'mi' ? 'Miles' : 'Kilometers'}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-text-faint">Applies across the plan, editor, and stats.</p>
        </section>

        {/* Email */}
        <section>
          <p className={eyebrow}>Email</p>
          <input aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          <Button variant="ghost" onClick={changeEmail} disabled={busy || !email.trim() || email.trim() === me.data?.email} className="mt-2">Change email</Button>
          <p className="mt-1 text-xs text-text-faint">We’ll email a confirmation link to the new address.</p>
        </section>

        {/* Password */}
        <section>
          <p className={eyebrow}>Password</p>
          <input aria-label="Current password" type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Current password" className={`${field} mb-2`} />
          <input aria-label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (min 6 chars)" className={field} />
          <Button variant="ghost" onClick={changePassword} disabled={busy || !oldPassword || !password} className="mt-2">Change password</Button>
        </section>

        {msg && <p className={`text-sm ${msg.ok ? 'text-accent' : 'text-missed'}`}>{msg.text}</p>}
      </div>
      <Button onClick={onClose} className="mt-4 w-full">Done</Button>
    </Modal>
  )
}
