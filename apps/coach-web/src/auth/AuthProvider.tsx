import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Role } from '../lib/types'

interface AuthState { session: Session | null; role: Role | null; isCoach: boolean; isAdmin: boolean; loading: boolean }
const Ctx = createContext<AuthState>({ session: null, role: null, isCoach: false, isAdmin: false, loading: true })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [isCoach, setIsCoach] = useState(false)
  // UI hint only — every admin RPC re-checks is_admin server-side.
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const apply = async (s: Session | null) => {
      setSession(s)
      if (s) {
        const { data } = await supabase.from('profiles').select('role, is_coach, is_admin, suspended_at').eq('id', s.user.id).single()
        setRole((data?.role as Role) ?? null)
        // Dual-role: gate on the flag; fall back to role for a pre-migration DB.
        setIsCoach(data?.is_coach ?? data?.role === 'coach')
        setIsAdmin(Boolean(data?.is_admin) && !data?.suspended_at)
      } else { setRole(null); setIsCoach(false); setIsAdmin(false) }
      setLoading(false)
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => apply(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return <Ctx.Provider value={{ session, role, isCoach, isAdmin, loading }}>{children}</Ctx.Provider>
}
