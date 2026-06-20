import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import type { CoachTitle } from '../lib/types'

const TITLES: CoachTitle[] = ['Head Coach', 'Assistant Coach', 'Strength Coach', 'Physio']
const FN = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/coach-signup`

export default function SignupPage() {
  const nav = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [title, setTitle] = useState<CoachTitle>('Head Coach')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true)
    const res = await fetch(FN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
      body: JSON.stringify({ ...form, title }),
    })
    if (!res.ok) { setBusy(false); setErr((await res.json()).error ?? 'Sign-up failed'); return }
    const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
    setBusy(false)
    if (error) setErr(error.message); else nav('/coach')
  }

  const field = (k: keyof typeof form, label: string, type = 'text') => (
    <label className="flex flex-col gap-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-text-mute">{label}
      <input aria-label={label} type={type} required value={form[k]}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        className="rounded-[10px] border border-line bg-surface2 px-3 py-2.5 text-[15px] font-normal normal-case tracking-normal text-text" />
    </label>
  )

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <form onSubmit={submit} className="rb-card flex w-full max-w-md flex-col gap-4 p-8">
        <h2 className="font-display text-3xl font-bold tracking-tight">Create a coach account</h2>
        {field('name', 'Full name')}
        {field('email', 'Work email', 'email')}
        {field('password', 'Password', 'password')}
        <div className="flex flex-wrap gap-2">
          {TITLES.map((t) => (
            <button type="button" key={t} onClick={() => setTitle(t)}
              className={`rounded-[20px] px-3 py-1.5 text-sm transition ${title === t ? 'bg-accent text-on-accent' : 'bg-chip text-text-mute hover:text-text'}`}>{t}</button>
          ))}
        </div>
        {err && <p className="text-sm text-missed">{err}</p>}
        <Button type="submit" disabled={busy}>{busy ? 'Creating…' : 'Create account'}</Button>
        <p className="text-sm text-text-mute">Have an account? <Link to="/login" className="text-accent hover:brightness-110">Sign in</Link></p>
      </form>
    </div>
  )
}
