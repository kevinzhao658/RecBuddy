import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'

/** Gate for /admin. A UX guard only — the admin RPCs and the admin-action
 *  function re-check profiles.is_admin on the server. Signed-out visitors go
 *  to /login and come back to the exact admin page (e.g. a report link). */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading } = useAuth()
  const location = useLocation()
  if (loading) return <div className="p-8 text-text-mute">Loading…</div>
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (!isAdmin) return <Navigate to="/coach" replace />
  return <>{children}</>
}
