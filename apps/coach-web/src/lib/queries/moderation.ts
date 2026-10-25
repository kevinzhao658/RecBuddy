import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'

/** Report + block (App Store 1.2 parity with iOS); server rules in 20261018120000_ugc_report_block.sql. */
export type ReportReason = 'harassment' | 'hate' | 'sexual' | 'violence' | 'spam' | 'other'
export const REPORT_REASONS: { reason: ReportReason; label: string }[] = [
  { reason: 'harassment', label: 'Harassment or bullying' },
  { reason: 'hate', label: 'Hate speech or slurs' },
  { reason: 'sexual', label: 'Sexual or inappropriate content' },
  { reason: 'violence', label: 'Threats, violence, or self-harm' },
  { reason: 'spam', label: 'Spam or scam' },
  { reason: 'other', label: 'Something else' },
]
export interface BlockedUser { user_id: string; name: string; initials: string; avatar_url: string | null }

/** Report a message (preferred: the server snapshots it) or, with no message, a user. */
export async function reportContent(client: SupabaseClient, v: { reason: ReportReason; messageId?: string; userId?: string; details?: string }): Promise<void> {
  const details = v.details?.trim()
  const { error } = await client.rpc('report_content', {
    p_reason: v.reason,
    p_message_id: v.messageId ?? null,
    p_reported_user_id: v.messageId ? null : v.userId ?? null,
    p_details: details ? details : null,
  })
  if (error) throw error
}
/** Blocks the user and severs any coaching link (one server transaction). */
export async function blockUser(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client.rpc('block_user', { p_user_id: userId })
  if (error) throw error
}
/** Blocking can sever a coaching link and cut access to threads: refresh
 *  everything that lists people or conversations. */
export function invalidateAfterBlock(qc: ReturnType<typeof useQueryClient>) {
  for (const key of ['conversations', 'blocked', 'roster', 'unread', 'messages', 'search-people']) {
    qc.invalidateQueries({ queryKey: [key] })
  }
}
export async function fetchBlockedUsers(client: SupabaseClient): Promise<BlockedUser[]> {
  const { data, error } = await client.rpc('get_blocked_users')
  if (error) throw error
  return data as BlockedUser[]
}

export function useBlockedUsers() {
  return useQuery({ queryKey: ['blocked'], queryFn: () => fetchBlockedUsers(supabase) })
}
export function useUnblock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { data: me } = await supabase.auth.getUser()
      const { error } = await supabase.from('user_blocks').delete().eq('blocker_id', me.user!.id).eq('blocked_id', userId)
      if (error) throw error
    },
    // Their chats, messages, and search results come back too.
    onSuccess: () => invalidateAfterBlock(qc),
  })
}
