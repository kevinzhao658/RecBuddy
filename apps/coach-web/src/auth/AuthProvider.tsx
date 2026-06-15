import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Role } from '../lib/types'

interface AuthState { session: Session | null; role: Role | null; loading: boolean }
const Ctx = createContext<AuthState>({ session: null, role: null, loading: true })
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const apply = async (s: Session | null) => {
      setSession(s)
      if (s) {
        const { data } = await supabase.from('profiles').select('role').eq('id', s.user.id).single()
        setRole((data?.role as Role) ?? null)
      } else setRole(null)
      setLoading(false)
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => apply(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  return <Ctx.Provider value={{ session, role, loading }}>{children}</Ctx.Provider>
}
