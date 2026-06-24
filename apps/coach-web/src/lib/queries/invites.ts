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
export interface InviteDraft {
  athleteName: string; goalRace?: string | null; goalDistance?: string | null
  goalDate?: string | null; goalTime?: string | null
}
export function useCreateInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (draft: InviteDraft) => {
      const { data, error } = await supabase.rpc('create_invite', {
        p_athlete_name: draft.athleteName,
        p_goal_race: draft.goalRace || null,
        p_goal_distance: draft.goalDistance || null,
        p_goal_date: draft.goalDate || null,
        p_goal_time: draft.goalTime || null,
      })
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
