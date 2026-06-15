import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'

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
      <div className="hidden flex-col justify-center bg-surface p-12 md:flex">
        <h1 className="text-5xl font-extrabold italic tracking-tight"><span className="text-accent">Rec</span>Buddy</h1>
        <p className="mt-2 uppercase tracking-[0.2em] text-text-mute">Coach</p>
      </div>
      <form onSubmit={submit} className="flex flex-col justify-center gap-4 p-12">
        <h2 className="text-3xl font-bold">Sign in</h2>
        <label className="flex flex-col gap-1 text-sm text-text-mute">Email
          <input aria-label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            className="rounded-[10px] border border-line bg-surface2 px-3 py-2 text-text" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-text-mute">Password
          <input aria-label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
            className="rounded-[10px] border border-line bg-surface2 px-3 py-2 text-text" />
        </label>
        {err && <p className="text-sm text-missed">{err}</p>}
        <Button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</Button>
        <p className="text-sm text-text-mute">New coach? <Link to="/signup" className="text-accent">Create an account</Link></p>
      </form>
    </div>
  )
}
