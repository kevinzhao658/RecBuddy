import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Wordmark } from '../components/ui/Wordmark'
import { IconField } from '../components/ui/IconField'
import { UserIcon, MailIcon, LockIcon } from '../components/ui/FormIcons'
import type { CoachTitle } from '../lib/types'

const TITLES: CoachTitle[] = ['Head Coach', 'Assistant Coach', 'Strength Coach', 'Physio']
const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach-signup`

export default function SignupPage() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [title, setTitle] = useState<CoachTitle>('Head Coach')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true)
    try {
      const res = await fetch(FN, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
        body: JSON.stringify({ ...form, title }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setErr(body.error ?? `Sign-up failed (${res.status})`)
        return
      }
      // Account created (unconfirmed). Send the confirmation email — the coach
      // must verify email ownership before their first sign-in.
      const { error } = await supabase.auth.resend({ type: 'signup', email: form.email })
      if (error) { setErr(error.message); return }
      setSent(true)
    } catch {
      setErr('Could not reach the sign-up service. Is the coach-signup function deployed?')
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    setErr(null)
    const { error } = await supabase.auth.resend({ type: 'signup', email: form.email })
    if (error) setErr(error.message)
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Brand panel */}
      <div className="rb-surface relative hidden flex-col overflow-hidden border-r border-line p-14 md:flex">
        <div className="pointer-events-none absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(173,255,47,0.16), transparent 65%)' }} />
        <div className="relative">
          <Wordmark className="text-6xl" />
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-text-mute">Coach</p>
        </div>
        <div className="relative mt-auto max-w-sm">
          <h1 className="text-[44px] font-bold leading-[1.05] tracking-tight">Start coaching<br />on RecBuddy.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-text-mute">
            Create your coach account, build your roster, and deliver tailored training plans your
            athletes will love.
          </p>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-8 md:p-12">
        {sent ? (
          <div className="w-full max-w-[400px]">
            <h2 className="text-[30px] font-bold tracking-tight">Check your email</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-text-mute">
              We sent a confirmation link to <span className="font-semibold text-text">{form.email}</span>. Click it to
              activate your coach account, then sign in.
            </p>
            <Link to="/login" className="mt-6 block"><Button className="w-full">Go to sign in</Button></Link>
            {err && <p className="mt-3 text-sm text-missed">{err}</p>}
            <p className="mt-3 text-center text-sm text-text-faint">
              Didn’t get it? Check spam, or <button type="button" onClick={resend} className="font-semibold text-accent hover:brightness-110">resend</button>.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="w-full max-w-[400px]">
            <h2 className="text-[30px] font-bold tracking-tight">Create your coach account</h2>
            <p className="mt-1 text-[15px] text-text-mute">Free to start. Add athletes and build plans in minutes.</p>

            <div className="mt-8 flex flex-col gap-4">
              <IconField label="Full name" icon={<UserIcon />} placeholder="Coach name" required
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <IconField label="Work email" type="email" icon={<MailIcon />} placeholder="you@email.com" required
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <IconField label="Password" type={show ? 'text' : 'password'} icon={<LockIcon />} placeholder="At least 6 characters" required
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                trailing={<button type="button" aria-label="Toggle visibility" onClick={() => setShow((s) => !s)} className="text-text-faint hover:text-text-mute">{show ? '🙈' : '👁'}</button>} />

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-text-mute">Coaching title</span>
                <div className="flex flex-wrap gap-2">
                  {TITLES.map((t) => (
                    <button type="button" key={t} onClick={() => setTitle(t)}
                      className={`rounded-[12px] border px-3.5 py-2 text-sm font-medium transition ${title === t ? 'border-accent bg-surface2 text-accent' : 'border-line bg-surface2 text-text-mute hover:text-text'}`}>{t}</button>
                  ))}
                </div>
              </div>

              {err && <p className="text-sm text-missed">{err}</p>}
              <Button type="submit" disabled={busy} className="w-full">{busy ? 'Creating…' : 'Create account'}</Button>
              <p className="text-center text-xs leading-relaxed text-text-faint">
                By creating an account you agree to RecBuddy’s Terms of Service and Privacy Policy.
              </p>
              <p className="mt-1 text-center text-sm text-text-mute">
                Already coaching here? <Link to="/login" className="font-semibold text-accent hover:brightness-110">Sign in</Link>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
