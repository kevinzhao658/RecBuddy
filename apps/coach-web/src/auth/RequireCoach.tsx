import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'

export function RequireCoach({ children }: { children: ReactNode }) {
  const { session, role, loading } = useAuth()
  if (loading) return <div className="p-8 text-text-mute">Loading…</div>
  if (!session || role !== 'coach') return <Navigate to="/login" replace />
  return <>{children}</>
}
