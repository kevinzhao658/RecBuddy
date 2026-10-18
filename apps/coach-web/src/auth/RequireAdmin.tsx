import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'

/** Gate for /admin. A UX guard only — the admin RPCs and the admin-action
 *  function re-check profiles.is_admin on the server. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading } = useAuth()
  if (loading) return <div className="p-8 text-text-mute">Loading…</div>
  if (!session) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/coach" replace />
  return <>{children}</>
}
