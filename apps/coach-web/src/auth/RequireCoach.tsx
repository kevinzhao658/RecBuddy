import { Navigate } from 'react-router-dom'
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
 *  Coaches go to /coach; admin-only accounts (no coach role) to /admin.
 *  The console has its own sign-in at /admin/login. */
export function RedirectIfCoach({ children }: { children: ReactNode }) {
  const { session, isCoach, isAdmin, loading } = useAuth()
  if (loading) return <div className="p-8 text-text-mute">Loading…</div>
  if (session && isCoach) return <Navigate to="/coach" replace />
  if (session && isAdmin) return <Navigate to="/admin" replace />
  return <>{children}</>
}
