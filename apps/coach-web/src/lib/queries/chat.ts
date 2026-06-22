import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Message, Thread } from '../types'

/** Get (or create) the coach↔athlete thread. RLS surfaces the head coach's
 *  thread to assistants, so we reuse an existing one before creating. */
export async function fetchThread(client: SupabaseClient, athleteId: string): Promise<Thread> {
  const { data: existing, error } = await client.from('message_threads')
    .select('id, athlete_id, coach_id').eq('athlete_id', athleteId).limit(1).maybeSingle()
  if (error) throw error
  if (existing) return existing as Thread
  const { data: me } = await client.auth.getUser()
  const { data: created, error: insErr } = await client.from('message_threads')
    .insert({ athlete_id: athleteId, coach_id: me.user!.id }).select('id, athlete_id, coach_id').single()
  if (insErr) throw insErr
  return created as Thread
}
export function useThread(athleteId: string | null) {
  return useQuery({ queryKey: ['thread', athleteId], queryFn: () => fetchThread(supabase, athleteId!), enabled: !!athleteId })
}

export async function fetchMessages(client: SupabaseClient, threadId: string): Promise<Message[]> {
  const { data, error } = await client.from('messages').select('*').eq('thread_id', threadId).order('created_at')
  if (error) throw error
  return data as Message[]
}
export function useMessages(threadId: string | null) {
  return useQuery({ queryKey: ['messages', threadId], queryFn: () => fetchMessages(supabase, threadId!), enabled: !!threadId })
}

export async function sendMessage(client: SupabaseClient, threadId: string, body: string): Promise<void> {
  const { data: me } = await client.auth.getUser()
  const { error } = await client.from('messages').insert({ thread_id: threadId, from_user_id: me.user!.id, kind: 'text', body })
  if (error) throw error
  await client.from('message_threads').update({ updated_at: new Date().toISOString() }).eq('id', threadId)
}
export function useSendMessage(threadId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: string) => sendMessage(supabase, threadId!, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', threadId] }),
  })
}

/** Mark the other party's unread messages in this thread as read. */
export async function markThreadRead(client: SupabaseClient, threadId: string, meId: string): Promise<void> {
  const { error } = await client.from('messages').update({ read: true })
    .eq('thread_id', threadId).eq('read', false).neq('from_user_id', meId)
  if (error) throw error
}
export function useMarkThreadRead(threadId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (meId: string) => markThreadRead(supabase, threadId!, meId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', threadId] }),
  })
}

/** Stream new messages for a thread into the cache. */
export function useRealtimeThread(threadId: string | null) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!threadId) return
    const ch = supabase.channel(`messages:${threadId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
        () => qc.invalidateQueries({ queryKey: ['messages', threadId] }))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [threadId, qc])
}
