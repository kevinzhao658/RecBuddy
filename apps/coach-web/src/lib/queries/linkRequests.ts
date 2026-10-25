import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'

/** A coaching link waiting on me: a co-coach invite (kind 'co_coach') or, for
 *  athletes, a coach asking to coach them (kind 'athlete', answered in the app). */
export interface LinkRequest {
  id: string; kind: 'co_coach' | 'athlete'; coach_id: string; athlete_id: string; relationship: 'head' | 'assistant'
  requester_name: string; athlete_name: string; created_at: string
}

export async function fetchMyLinkRequests(client: SupabaseClient): Promise<LinkRequest[]> {
  const { data, error } = await client.rpc('my_link_requests'); if (error) throw error; return data as LinkRequest[]
}
export async function respondLinkRequest(client: SupabaseClient, id: string, accept: boolean) {
  const { error } = await client.rpc('respond_link_request', { p_id: id, p_accept: accept }); if (error) throw error
}

export function useMyLinkRequests() { return useQuery({ queryKey: ['link-requests'], queryFn: () => fetchMyLinkRequests(supabase) }) }
export function useRespondLinkRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => respondLinkRequest(supabase, id, accept),
    onSuccess: () => {
      // Accepting adds an athlete to my roster and opens their team chat.
      for (const key of ['link-requests', 'roster', 'conversations', 'unread']) qc.invalidateQueries({ queryKey: [key] })
    },
  })
}
