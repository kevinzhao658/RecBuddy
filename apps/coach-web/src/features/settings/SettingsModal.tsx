import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { supabase } from '../../lib/supabase'
import { useMe, useUpdateProfile } from '../../lib/queries/me'
import { EyeIcon, EyeOffIcon } from '../../components/ui/FormIcons'
import { useUnit } from '../../lib/useUnit'
import type { CoachTitle } from '../../lib/types'

const TITLES: CoachTitle[] = ['Head Coach', 'Assistant Coach', 'Strength Coach', 'Physio']
const field = 'w-full rounded-[10px] border border-line bg-surface2 px-3 py-2 text-sm text-text placeholder:text-text-faint focus:border-text-mute focus:outline-none'
const label = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.08em] text-text-faint'
const eyebrow = 'mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-accent'

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe()
  const qc = useQueryClient()
  const updateProfile = useUpdateProfile()
  const { unit, setUnit } = useUnit()

  const [name, setName] = useState('')
  const [title, setTitle] = useState<CoachTitle>('Head Coach')
  const [email, setEmail] = useState('')
  const [emailStage, setEmailStage] = useState<'idle' | 'code'>('idle')
  const [code, setCode] = useState('')
  const [cooldown, setCooldown] = useState(0)
  const [oldPassword, setOldPassword] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Seed fields from the loaded profile each time the modal opens.
  useEffect(() => {
    if (open && me.data) {
      setName(me.data.name); setTitle((me.data.title as CoachTitle) ?? 'Head Coach')
      setEmail(me.data.email); setEmailStage('idle'); setCode(''); setCooldown(0)
      setOldPassword(''); setPassword(''); setShowPw(false); setMsg(null)
    }
  }, [open, me.data])

  // Resend cooldown tick.
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const flash = (ok: boolean, text: string) => setMsg({ ok, text })

  const saveProfile = () =>
    updateProfile.mutate({ name: name.trim(), title }, {
      onSuccess: () => flash(true, 'Profile updated.'),
      onError: (e: any) => flash(false, e.message),
    })

  // Email change via OTP code (no link / no leaving the modal).
  const sendEmailCode = async () => {
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ email: email.trim() })
    setBusy(false)
    if (error) return flash(false, error.message)
    setEmailStage('code'); setCooldown(60); flash(true, `Code sent to ${email.trim()}.`)
  }
  const verifyEmailCode = async () => {
    setBusy(true)
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email_change' })
    if (!error && me.data) await supabase.from('profiles').update({ email: email.trim() }).eq('id', me.data.id)
    setBusy(false)
    if (error) return flash(false, error.message || 'Invalid or expired code.')
    setEmailStage('idle'); setCode(''); qc.invalidateQueries({ queryKey: ['me'] }); flash(true, 'Email updated.')
  }

  const changePassword = async () => {
    if (!oldPassword) return flash(false, 'Enter your current password.')
    if (password.length < 6) return flash(false, 'New password must be at least 6 characters.')
    setBusy(true)
    const { error: vErr } = await supabase.auth.signInWithPassword({ email: me.data?.email ?? '', password: oldPassword })
    if (vErr) { setBusy(false); return flash(false, 'Current password is incorrect.') }
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) flash(false, error.message)
    else { setOldPassword(''); setPassword(''); flash(true, 'Password updated.') }
  }

  const eye = (
    <button type="button" aria-label="Toggle password visibility" onClick={() => setShowPw((s) => !s)}
      className="absolute right-2 top-1/2 -translate-y-1/2 text-text-faint hover:text-text-mute">{showPw ? <EyeOffIcon /> : <EyeIcon />}</button>
  )

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
          {emailStage === 'idle' ? (
            <>
              <input aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
              <Button variant="ghost" onClick={sendEmailCode} disabled={busy || !email.trim() || email.trim() === me.data?.email} className="mt-2">Send code</Button>
              <p className="mt-1 text-xs text-text-faint">We’ll email a verification code to the new address.</p>
            </>
          ) : (
            <>
              <p className="mb-2 text-xs text-text-faint">Enter the code sent to <span className="text-text">{email.trim()}</span>.</p>
              <input aria-label="Email code" inputMode="numeric" value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Verification code" className={`${field} font-num tracking-[0.3em]`} />
              <div className="mt-2 flex items-center gap-3">
                <Button variant="ghost" onClick={verifyEmailCode} disabled={busy || code.length < 6}>Verify & update</Button>
                <button type="button" onClick={sendEmailCode} disabled={cooldown > 0 || busy}
                  className="text-xs font-semibold text-accent disabled:text-text-faint disabled:hover:brightness-100">
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
                <button type="button" onClick={() => { setEmailStage('idle'); setCode('') }} className="ml-auto text-xs text-text-faint hover:text-text">Cancel</button>
              </div>
            </>
          )}
        </section>

        {/* Password */}
        <section>
          <p className={eyebrow}>Password</p>
          <div className="relative mb-2">
            <input aria-label="Current password" type={showPw ? 'text' : 'password'} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Current password" className={`${field} pr-10`} />
            {eye}
          </div>
          <div className="relative">
            <input aria-label="New password" type={showPw ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password (min 6 chars)" className={`${field} pr-10`} />
            {eye}
          </div>
          <Button variant="ghost" onClick={changePassword} disabled={busy || !oldPassword || !password} className="mt-2">Change password</Button>
        </section>

        {msg && <p className={`text-sm ${msg.ok ? 'text-accent' : 'text-missed'}`}>{msg.text}</p>}
      </div>
      <Button onClick={onClose} className="mt-4 w-full">Done</Button>
    </Modal>
  )
}
