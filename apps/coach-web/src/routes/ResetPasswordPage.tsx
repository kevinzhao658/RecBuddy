import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { parseAuthError, recoveryTokenHash } from '../lib/authRedirect'
import { useAuth } from '../auth/AuthProvider'
import { Button } from '../components/ui/Button'
import { Wordmark } from '../components/ui/Wordmark'
import { IconField } from '../components/ui/IconField'
import { LockIcon, EyeIcon, EyeOffIcon } from '../components/ui/FormIcons'
import { Footer } from '../components/ui/Footer'

const EXPIRED = 'This password-reset link is invalid or has expired.'

export default function ResetPasswordPage() {
  const { session, loading, isCoach } = useAuth()
  // Captured on mount: supabase-js rewrites the URL once it reads a session from it.
  const [tokenHash] = useState(() => recoveryTokenHash(window.location.search))
  const [expired, setExpired] = useState<string | null>(() => {
    const linkErr = parseAuthError(window.location.hash)
    return linkErr ? linkErr.description || EXPIRED : null
  })
  const [verified, setVerified] = useState(false)
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null)
    if (password.length < 6) return setErr('Password must be at least 6 characters.')
    setBusy(true)
    // Verify the one-time token only on submit, so an email scanner opening the link
    // can't use it up first. Always verify when present — never reuse whatever
    // session this browser already holds, which could be a different account.
    if (tokenHash && !verified) {
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })
      if (error) { setBusy(false); return setExpired(error.message || EXPIRED) }
      setVerified(true)
    }
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setErr(error.message)
    else setDone(true)
  }

  // Token-hash links carry their own credential; legacy links need the session
  // supabase-js restores from the URL.
  const needsSession = !tokenHash

  return (
    <div className="flex min-h-screen flex-col">
      <div className="grid flex-1 place-items-center p-8">
        <div className="w-full max-w-[380px]">
          <Wordmark className="text-3xl" />
          {expired || (needsSession && !loading && !session && !done) ? (
            <>
              <h2 className="mt-8 text-[26px] font-bold tracking-tight">Link expired</h2>
              <p className="mt-1 text-[15px] text-text-mute">{expired ?? EXPIRED}</p>
              <p className="mt-2 text-[15px] text-text-mute">Request a new link from the sign-in page or the RecBuddy app.</p>
              <Link to="/login" className="mt-6 block"><Button className="w-full">Back to sign in</Button></Link>
            </>
          ) : needsSession && loading ? (
            <p className="mt-8 text-text-mute">Loading…</p>
          ) : done ? (
            /* Most resets come from the athlete app, so send people back there instead
               of into the coach dashboard. On a phone the link opens the app. */
            <>
              <h2 className="mt-8 text-[26px] font-bold tracking-tight">You’re all set</h2>
              <p className="mt-1 text-[15px] text-text-mute">
                Your password has been updated. Head back to the RecBuddy app and sign in with your new password. You can close this window now.
              </p>
              <a href="recbuddy://" className="mt-6 block">
                <Button className="w-full">Open the RecBuddy app</Button>
              </a>
              <p className="mt-3 text-center text-sm text-text-faint">On your phone, this opens the app directly.</p>
              {isCoach && (
                <Link to="/coach" className="mt-4 block text-center text-sm font-semibold text-accent hover:brightness-110">
                  Go to your coach dashboard
                </Link>
              )}
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
      <Footer />
    </div>
  )
}
