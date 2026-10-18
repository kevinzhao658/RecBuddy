import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'

export function RequireCoach({ children }: { children: ReactNode }) {
  const { session, isCoach, loading } = useAuth()
  if (loading) return <div className="p-8 text-text-mute">Loading…</div>
  if (!session || !isCoach) return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Inverse of RequireCoach: keep signed-in coaches and admins out of /login
 *  & /signup. So when a confirmation link establishes a session, the stale
 *  page auto-advances (synced across tabs via the shared session).
 *  Destination: the admin page they were sent from (RequireAdmin passes
 *  state.from), else /coach for coaches, else /admin for admin-only accounts. */
export function RedirectIfCoach({ children }: { children: ReactNode }) {
  const { session, isCoach, isAdmin, loading } = useAuth()
  const from = (useLocation().state as { from?: string } | null)?.from
  if (loading) return <div className="p-8 text-text-mute">Loading…</div>
  if (session && isAdmin && from?.startsWith('/admin')) return <Navigate to={from} replace />
  if (session && isCoach) return <Navigate to="/coach" replace />
  if (session && isAdmin) return <Navigate to="/admin" replace />
  return <>{children}</>
}
