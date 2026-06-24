import { useQuery } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { Profile } from '../types'

/** The signed-in coach's own profile (name/initials/title for the sidebar). */
export async function fetchMe(): Promise<Profile | null> {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', u.user.id).single()
  return (data as Profile) ?? null
}

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: fetchMe })
}
