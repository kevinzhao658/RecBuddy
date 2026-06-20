import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { Wordmark } from '../components/ui/Wordmark'

export default function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) setErr(error.message)
    else nav('/coach')
  }

  return (
    <div className="grid min-h-screen md:grid-cols-2">
      <div className="rb-surface hidden h-full flex-col justify-center border-r border-line p-12 md:flex">
        <Wordmark className="text-6xl" />
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.24em] text-text-mute">Coach</p>
        <p className="mt-6 font-display text-sm font-bold uppercase tracking-[0.1em] text-text-mute">Unleash yourself</p>
      </div>
      <form onSubmit={submit} className="flex flex-col justify-center gap-4 p-12">
        <h2 className="font-display text-3xl font-bold tracking-tight">Sign in</h2>
        <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-text-mute">Email
          <input aria-label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="rounded-[10px] border border-line bg-surface2 px-3 py-2.5 text-[15px] font-normal normal-case tracking-normal text-text" />
        </label>
        <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-text-mute">Password
          <input aria-label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="rounded-[10px] border border-line bg-surface2 px-3 py-2.5 text-[15px] font-normal normal-case tracking-normal text-text" />
        </label>
        {err && <p className="text-sm text-missed">{err}</p>}
        <Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</Button>
        <p className="text-sm text-text-mute">New coach? <Link to="/signup" className="text-accent hover:brightness-110">Create an account</Link></p>
      </form>
    </div>
  )
}
