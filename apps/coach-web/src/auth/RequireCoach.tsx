import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'

export function RequireCoach({ children }: { children: ReactNode }) {
  const { session, role, loading } = useAuth()
  if (loading) return <div className="p-8 text-text-mute">Loading…</div>
  if (!session || role !== 'coach') return <Navigate to="/login" replace />
  return <>{children}</>
}

/** Inverse of RequireCoach: keep authenticated coaches out of /login & /signup.
 *  So when a confirmation link establishes a session, the stale signup/login
 *  page auto-advances to /coach (synced across tabs via the shared session). */
export function RedirectIfCoach({ children }: { children: ReactNode }) {
  const { session, role, loading } = useAuth()
  if (loading) return <div className="p-8 text-text-mute">Loading…</div>
  if (session && role === 'coach') return <Navigate to="/coach" replace />
  return <>{children}</>
}
