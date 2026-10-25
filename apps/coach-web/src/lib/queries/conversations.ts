import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, uniqueTopic } from '../supabase'
import type { ChatPerson, Conversation, ThreadPerson } from '../types'
import { pendingConversation } from '../conversations'

export async function fetchConversations(client: SupabaseClient): Promise<Conversation[]> {
  const { data, error } = await client.rpc('my_conversations')
  if (error) throw error
  return data as Conversation[]
}
export async function searchPeople(client: SupabaseClient, query: string): Promise<ChatPerson[]> {
  const { data, error } = await client.rpc('search_chat_people', { p_query: query })
  if (error) throw error
  return data as ChatPerson[]
}
export async function startConversation(client: SupabaseClient, userIds: string[], title: string | null): Promise<string> {
  const { data, error } = await client.rpc('start_conversation', { p_user_ids: userIds, p_title: title })
  if (error) throw error
  return data as string
}
export async function fetchThreadPeople(client: SupabaseClient, threadId: string): Promise<ThreadPerson[]> {
  const { data, error } = await client.rpc('thread_people', { p_thread: threadId })
  if (error) throw error
  return data as ThreadPerson[]
}

const invalidateInbox = (qc: ReturnType<typeof useQueryClient>) => qc.invalidateQueries({ queryKey: ['conversations'] })

/** Inbox, kept live: new messages anywhere I can read, and my membership changes. */
export function useConversations(meId: string | null) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!meId) return
    const ch = supabase.channel(uniqueTopic(`inbox:${meId}`))
      // new, edited and deleted messages all change a chat's preview line
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => invalidateInbox(qc))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'thread_members', filter: `user_id=eq.${meId}` }, () => invalidateInbox(qc))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [meId, qc])
  return useQuery({ queryKey: ['conversations'], queryFn: () => fetchConversations(supabase), enabled: !!meId })
}
export function useSearchPeople(query: string) {
  return useQuery({ queryKey: ['search-people', query], queryFn: () => searchPeople(supabase, query), staleTime: 30_000 })
}
export function useThreadPeople(threadId: string | null) {
  return useQuery({ queryKey: ['thread-people', threadId], queryFn: () => fetchThreadPeople(supabase, threadId!), enabled: !!threadId })
}
/** The open thread before it reaches the inbox (no messages yet): its name and people. */
export function usePendingConversation(threadId: string | null, meId: string) {
  const people = useThreadPeople(threadId)
  const thread = useQuery({
    queryKey: ['thread-meta', threadId],
    enabled: !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase.from('message_threads').select('kind, title, read_only').eq('id', threadId!).single()
      if (error) throw error
      return data as { kind: 'team' | 'chat'; title: string | null; read_only: boolean }
    },
  })
  return threadId && thread.data && people.data ? pendingConversation(threadId, thread.data, people.data, meId) : null
}
export function useStartConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { userIds: string[]; title: string | null }) => startConversation(supabase, v.userIds, v.title),
    onSuccess: () => invalidateInbox(qc),
  })
}
/** Returns the thread to open: the same group, or a new group when adding to a 1:1. */
export function useAddMembers() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { threadId: string; userIds: string[] }) => {
      const { data, error } = await supabase.rpc('add_conversation_members', { p_thread: v.threadId, p_user_ids: v.userIds })
      if (error) throw error
      return data as string
    },
    onSuccess: () => { invalidateInbox(qc); qc.invalidateQueries({ queryKey: ['thread-people'] }) },
  })
}
function threadAction(rpc: 'leave_conversation' | 'hide_conversation') {
  return function useAction() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (threadId: string) => {
        const { error } = await supabase.rpc(rpc, { p_thread: threadId })
        if (error) throw error
      },
      onSuccess: () => invalidateInbox(qc),
    })
  }
}
export const useLeaveConversation = threadAction('leave_conversation')
export const useHideConversation = threadAction('hide_conversation')
export function useRemoveMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { threadId: string; userId: string }) => {
      const { error } = await supabase.rpc('remove_conversation_member', { p_thread: v.threadId, p_user: v.userId })
      if (error) throw error
    },
    onSuccess: () => { invalidateInbox(qc); qc.invalidateQueries({ queryKey: ['thread-people'] }) },
  })
}
export function useRenameConversation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { threadId: string; title: string }) => {
      const { error } = await supabase.rpc('rename_conversation', { p_thread: v.threadId, p_title: v.title })
      if (error) throw error
    },
    onSuccess: () => invalidateInbox(qc),
  })
}
