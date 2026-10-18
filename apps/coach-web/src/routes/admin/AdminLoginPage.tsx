import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../auth/AuthProvider'
import { Button } from '../../components/ui/Button'
import { Wordmark } from '../../components/ui/Wordmark'
import { IconField } from '../../components/ui/IconField'
import { MailIcon, LockIcon, EyeIcon, EyeOffIcon } from '../../components/ui/FormIcons'

/** /admin/login — the console's own sign-in. Same RecBuddy account as the
 *  coach app; only accounts with admin access get in (the server re-checks
 *  every admin call regardless). Returns to the admin page you came from. */
export default function AdminLoginPage() {
  const nav = useNavigate()
  const { session, isAdmin, loading } = useAuth()
  const from = (useLocation().state as { from?: string } | null)?.from
  const dest = from?.startsWith('/admin') && from !== '/admin/login' ? from : '/admin/reports'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return <div className="p-8 text-text-mute">Loading…</div>
  if (session && isAdmin && !busy) return <Navigate to={dest} replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBusy(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setErr(error.message); return }
      const { data: p } = await supabase.from('profiles').select('is_admin, suspended_at').eq('id', data.user.id).single()
      if (!p?.is_admin || p.suspended_at) {
        await supabase.auth.signOut()
        setErr("This account doesn't have admin access.")
        return
      }
      nav(dest, { replace: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-bg px-6 text-text">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2.5">
          <Wordmark className="text-3xl" />
          <span className="rounded-md bg-missed/15 px-1.5 py-0.5 text-xs font-semibold text-missed">Admin</span>
        </div>
        <form onSubmit={submit} className="rb-card space-y-4 p-6" aria-label="Admin sign in">
          <div>
            <h1 className="text-lg font-semibold">Sign in to the admin console</h1>
            <p className="mt-1 text-sm text-text-mute">Use your RecBuddy account. Only accounts with admin access can sign in.</p>
          </div>
          <IconField label="Email" type="email" autoComplete="username" required value={email}
            onChange={(e) => setEmail(e.target.value)} icon={<MailIcon />} />
          <IconField label="Password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password}
            onChange={(e) => setPassword(e.target.value)} icon={<LockIcon />}
            trailing={
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
                className="pointer-events-auto text-text-faint hover:text-text-mute">
                {show ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            } />
          {err && <p className="text-sm text-missed" role="alert">{err}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
        </form>
        <p className="mt-4 text-center text-xs text-text-faint">
          Not an admin? <Link to="/login" className="text-text-mute hover:text-text">Coach sign-in</Link>
        </p>
      </div>
    </div>
  )
}
