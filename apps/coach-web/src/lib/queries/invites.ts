import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Invite } from '../types'

export async function fetchPendingInvites(client: SupabaseClient): Promise<Invite[]> {
  const { data, error } = await client.from('invites').select('*').is('consumed_at', null).order('created_at', { ascending: false })
  if (error) throw error
  return data as Invite[]
}
export function usePendingInvites() {
  return useQuery({ queryKey: ['invites'], queryFn: () => fetchPendingInvites(supabase) })
}
export function useCreateInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (athleteName: string) => {
      const { data, error } = await supabase.rpc('create_invite', { p_athlete_name: athleteName })
      if (error) throw error
      return data as string
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  })
}
export function useRevokeInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from('invites').delete().eq('id', id); if (error) throw error },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invites'] }),
  })
}
