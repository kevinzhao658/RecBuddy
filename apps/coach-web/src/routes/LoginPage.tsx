import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCooldown } from '../lib/useCooldown'
import { emailHasAccount } from '../lib/queries/account'
import { Button } from '../components/ui/Button'
import { Wordmark } from '../components/ui/Wordmark'
import { IconField } from '../components/ui/IconField'
import { MailIcon, LockIcon, GoogleIcon, EyeIcon, EyeOffIcon } from '../components/ui/FormIcons'
import { Footer } from '../components/ui/Footer'

// Matches Supabase's default per-address email interval. Every new reset email also
// invalidates the previous link, so rapid resends only produce dead links.
const RESEND_COOLDOWN_S = 60

export default function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)
  // The reset screen keeps its own email and in-flight flag, so using it never
  // changes the sign-in form.
  const [resetEmail, setResetEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [resetMsg, setResetMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const cooldown = useCooldown()

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message)
    else nav('/coach')
  }

  async function sendReset() {
    const addr = resetEmail.trim()
    if (!addr) return setResetMsg({ ok: false, text: 'Enter your email first.' })
    setSending(true)
    // Supabase's reset silently succeeds for unknown addresses, so check first. If the
    // check itself fails, fall through and send rather than block a real reset.
    const exists = await emailHasAccount(supabase, addr).catch(() => null)
    if (exists === false) {
      setSending(false)
      return setResetMsg({ ok: false, text: 'We couldn’t find an account with that email.' })
    }
    const { error } = await supabase.auth.resetPasswordForEmail(addr, { redirectTo: `${window.location.origin}/reset-password` })
    setSending(false)
    if (!error || error.status === 429) cooldown.start(RESEND_COOLDOWN_S)
    setResetMsg(error ? { ok: false, text: error.message } : { ok: true, text: `Reset link sent to ${addr}. Check your inbox.` })
  }

  return (
    <div className="flex min-h-screen flex-col">
      <div className="grid flex-1 md:grid-cols-2">
        {/* Brand panel */}
        <div className="rb-surface relative hidden flex-col overflow-hidden border-r border-line p-14 md:flex">
          <div className="pointer-events-none absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(173,255,47,0.16), transparent 65%)' }} />
          <div className="relative">
            <Wordmark className="text-6xl" />
            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-text-mute">Coach</p>
          </div>
          <div className="relative mt-auto max-w-sm">
            <h1 className="text-[44px] font-bold leading-[1.05] tracking-tight">Build the plan.<br />Coach every mile.</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-text-mute">
              Your athletes, their weeks, and every workout — in one place. Drag, adjust, and keep
              everyone on pace for race day.
            </p>
          </div>
        </div>

        {/* Form panel */}
        <div className="flex items-center justify-center p-8 md:p-12">
          {forgot ? (
            <div className="w-full max-w-[380px]">
              <h2 className="text-[30px] font-bold tracking-tight">Reset your password</h2>
              <p className="mt-1 text-[15px] text-text-mute">Enter your email and we’ll send a reset link.</p>
              <div className="mt-8 flex flex-col gap-4">
                <IconField label="Email" type="email" required icon={<MailIcon />} placeholder="you@email.com"
                  value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} />
                {resetMsg && <p className={`text-sm ${resetMsg.ok ? 'text-accent' : 'text-missed'}`}>{resetMsg.text}</p>}
                <Button onClick={sendReset} disabled={sending || !resetEmail.trim() || cooldown.remaining > 0} className="w-full">
                  {sending ? 'Sending…' : cooldown.remaining > 0 ? `Resend in ${cooldown.remaining}s` : 'Send reset link'}
                </Button>
                <button type="button" onClick={() => { setForgot(false); setResetMsg(null) }} className="text-center text-sm text-text-mute hover:text-text">← Back to sign in</button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="w-full max-w-[380px]">
              <h2 className="text-[30px] font-bold tracking-tight">Coach sign in</h2>
              <p className="mt-1 text-[15px] text-text-mute">Welcome back. Let’s get your athletes moving.</p>

              <div className="mt-8 flex flex-col gap-4">
                <IconField label="Email" type="email" required icon={<MailIcon />} placeholder="you@email.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} />
                <IconField label="Password" type={show ? 'text' : 'password'} required icon={<LockIcon />}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  trailing={<button type="button" aria-label="Toggle visibility" onClick={() => setShow((s) => !s)} className="text-text-faint hover:text-text-mute">{show ? <EyeOffIcon /> : <EyeIcon />}</button>} />
                {err && <p className="text-sm text-missed">{err}</p>}
                <Button type="submit" disabled={busy} className="w-full">{busy ? 'Signing in…' : 'Log in'}</Button>

                <div className="my-1 flex items-center gap-3 text-xs text-text-faint">
                  <span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" />
                </div>
                <button type="button" onClick={() => setErr('Google sign-in is coming soon — use email + password for now.')}
                  className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-line bg-surface2 py-2.5 text-sm font-semibold text-text hover:border-text-mute">
                  <GoogleIcon /> Continue with Google
                </button>

                <div className="mt-1 flex items-center justify-between text-sm">
                  <button type="button" onClick={() => { setResetEmail(email); setForgot(true); setErr(null) }} className="text-text-mute hover:text-text">Forgot password?</button>
                  <span className="font-semibold text-accent">Athlete? Open the app →</span>
                </div>
                <p className="mt-2 text-center text-sm text-text-mute">
                  New to RecBuddy? <Link to="/signup" className="font-semibold text-accent hover:brightness-110">Create a coach account</Link>
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
      <Footer />
    </div>
  )
}
