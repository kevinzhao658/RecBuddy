import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui/Button'
import { Wordmark } from '../components/ui/Wordmark'
import { IconField } from '../components/ui/IconField'
import { LockIcon, EyeIcon, EyeOffIcon } from '../components/ui/FormIcons'

export default function ResetPasswordPage() {
  const { session, loading } = useAuth()
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null)
    if (password.length < 6) return setErr('Password must be at least 6 characters.')
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setErr(error.message)
    else { setDone(true); setTimeout(() => nav('/coach'), 1200) }
  }

  return (
    <div className="grid min-h-screen place-items-center p-8">
      <div className="w-full max-w-[380px]">
        <Wordmark className="text-3xl" />
        {loading ? (
          <p className="mt-8 text-text-mute">Loading…</p>
        ) : !session ? (
          <>
            <h2 className="mt-8 text-[26px] font-bold tracking-tight">Link expired</h2>
            <p className="mt-1 text-[15px] text-text-mute">This password-reset link is invalid or has expired.</p>
            <Link to="/login" className="mt-6 block"><Button className="w-full">Back to sign in</Button></Link>
          </>
        ) : done ? (
          <>
            <h2 className="mt-8 text-[26px] font-bold tracking-tight">Password updated</h2>
            <p className="mt-1 text-[15px] text-text-mute">Taking you to your dashboard…</p>
          </>
        ) : (
          <form onSubmit={submit}>
            <h2 className="mt-8 text-[26px] font-bold tracking-tight">Set a new password</h2>
            <p className="mt-1 text-[15px] text-text-mute">Choose a new password for your account.</p>
            <div className="mt-6 flex flex-col gap-4">
              <IconField label="New password" type={show ? 'text' : 'password'} required icon={<LockIcon />} placeholder="At least 6 characters"
                value={password} onChange={(e) => setPassword(e.target.value)}
                trailing={<button type="button" aria-label="Toggle visibility" onClick={() => setShow((s) => !s)} className="text-text-faint hover:text-text-mute">{show ? <EyeOffIcon /> : <EyeIcon />}</button>} />
              {err && <p className="text-sm text-missed">{err}</p>}
              <Button type="submit" disabled={busy || password.length < 6} className="w-full">{busy ? 'Updating…' : 'Update password'}</Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
