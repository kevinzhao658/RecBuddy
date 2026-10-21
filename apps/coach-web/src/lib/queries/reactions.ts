import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Reaction, ReactionKind } from '../types'

export async function fetchReactions(client: SupabaseClient, threadId: string): Promise<Reaction[]> {
  const { data, error } = await client.from('message_reactions').select('message_id, user_id, kind').eq('thread_id', threadId)
  if (error) throw error
  return (data as Reaction[]).filter((r) => r.kind)
}
/** Toggle: returns the new kind, or null when the same kind removed it. */
export async function setReaction(client: SupabaseClient, messageId: string, kind: ReactionKind): Promise<ReactionKind | null> {
  const { data, error } = await client.rpc('set_reaction', { p_message: messageId, p_kind: kind })
  if (error) throw error
  return data as ReactionKind | null
}

/** A thread's reactions, live (un-reacts are UPDATEs to kind = null, so RLS filters them). */
export function useReactions(threadId: string | null) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!threadId) return
    const ch = supabase.channel(`reactions:${threadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions', filter: `thread_id=eq.${threadId}` },
        () => qc.invalidateQueries({ queryKey: ['reactions', threadId] }))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [threadId, qc])
  return useQuery({ queryKey: ['reactions', threadId], queryFn: () => fetchReactions(supabase, threadId!), enabled: !!threadId })
}
export function useSetReaction(threadId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { messageId: string; kind: ReactionKind }) => setReaction(supabase, v.messageId, v.kind),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reactions', threadId] }),
  })
}
