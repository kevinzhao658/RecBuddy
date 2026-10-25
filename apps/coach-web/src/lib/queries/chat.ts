import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, uniqueTopic } from '../supabase'
import { compressImage } from '../compressImage'
import type { Message, Thread, Workout, WorkoutQuote } from '../types'
import { putVideo } from '../videoStore'

/** A text send, optionally replying to a message and/or about a workout. */
export type SendArgs = {
  body: string
  replyToId?: string | null
  workout?: Pick<Workout, 'id' | 'date' | 'type' | 'title'> | null
}

/** The athlete's TEAM thread (get-or-create server-side via team_thread_id). */
export async function fetchThread(client: SupabaseClient, athleteId: string): Promise<Thread> {
  const { data: id, error } = await client.rpc('team_thread_id', { p_athlete: athleteId })
  if (error) throw error
  return { id: id as string, athlete_id: athleteId, coach_id: '' }
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

export async function sendMessage(client: SupabaseClient, threadId: string, args: SendArgs): Promise<void> {
  const { data: me } = await client.auth.getUser()
  const { body, replyToId, workout } = args
  const payload: WorkoutQuote | null = workout
    ? { quote: 'workout', title: workout.title, date: workout.date, type: workout.type } : null
  const { error } = await client.from('messages').insert({
    thread_id: threadId, from_user_id: me.user!.id, kind: 'text', body,
    reply_to_id: replyToId ?? null, workout_id: workout?.id ?? null, payload,
  })
  if (error) throw error
}
export function useSendMessage(threadId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: SendArgs) => sendMessage(supabase, threadId!, args),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', threadId] }),
  })
}

/** Upload a client-compressed image and post it as kind='image'. Path convention:
 *  <thread_id>/<uuid>.jpg — first segment is the thread_id, which the storage
 *  policy uses to scope access to thread participants.  The path (not a public URL)
 *  is stored in the payload; callers exchange it for a signed URL at render time. */
export async function sendImageMessages(client: SupabaseClient, threadId: string, files: File[], body?: string, replyToId?: string | null): Promise<void> {
  const { data: me } = await client.auth.getUser()
  const uid = me.user!.id
  for (let i = 0; i < files.length; i++) {
    const { blob, w, h } = await compressImage(files[i])
    const path = `${threadId}/${crypto.randomUUID()}.jpg`
    const { error: upErr } = await client.storage
      .from('chat-images')
      .upload(path, blob, { contentType: 'image/jpeg' })
    if (upErr) throw upErr
    // The caption rides on the LAST image so it reads beneath the batch.
    const caption = i === files.length - 1 ? body || null : null
    const { error } = await client.from('messages')
      // The reply rides on the FIRST photo (it answers the quoted message).
      .insert({ thread_id: threadId, from_user_id: uid, kind: 'image', body: caption, payload: { path, w, h },
                reply_to_id: i === 0 ? replyToId ?? null : null })
    if (error) throw error
  }
}
export function useSendImages(threadId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { files: File[]; body?: string; replyToId?: string | null }) => sendImageMessages(supabase, threadId!, v.files, v.body, v.replyToId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', threadId] }),
  })
}

/** A clip ready to send: checked by checkVideo, poster from posterFrame. */
export interface StagedVideo { file: File; duration: number; w: number; h: number; poster: Blob | null }

/** Upload a chat video (as-is; checked against the 60 s / 50 MB limits) and its
 *  poster, then post kind='video'. Paths follow the photo convention
 *  (<thread_id>/<uuid>.<ext>). The server sets expires_at (7 days). This browser
 *  keeps its own copy under the new message id, so the sender never needs to
 *  download it and can still play it after the server copy is purged. */
export async function sendVideoMessage(client: SupabaseClient, threadId: string, v: StagedVideo, body?: string, replyToId?: string | null): Promise<string> {
  const { data: me } = await client.auth.getUser()
  const uid = me.user!.id
  const ext = v.file.type === 'video/quicktime' ? 'mov' : 'mp4'
  const path = `${threadId}/${crypto.randomUUID()}.${ext}`
  let poster: string | null = null
  if (v.poster) {
    poster = `${threadId}/${crypto.randomUUID()}.jpg`
    const { error } = await client.storage.from('chat-images').upload(poster, v.poster, { contentType: 'image/jpeg' })
    if (error) throw error
  }
  const { error: upErr } = await client.storage.from('chat-videos').upload(path, v.file, { contentType: v.file.type })
  if (upErr) throw upErr
  const { data, error } = await client.from('messages')
    .insert({ thread_id: threadId, from_user_id: uid, kind: 'video', body: body || null, reply_to_id: replyToId ?? null,
              payload: { path, poster, w: v.w, h: v.h, duration_s: v.duration } })
    .select('id').single()
  if (error) throw error
  await putVideo(data.id, v.file)
  return data.id as string
}
export function useSendVideo(threadId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (x: { video: StagedVideo; body?: string; replyToId?: string | null }) => sendVideoMessage(supabase, threadId!, x.video, x.body, x.replyToId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages', threadId] }),
  })
}

/** Download a chat video the caller can read (members only, while it lasts). */
export async function downloadVideo(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from('chat-videos').download(path)
  if (error) throw error
  return data
}

/** One-off signed URL for a chat image (Copy image). */
export async function signedChatImageUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('chat-images').createSignedUrl(path, 300)
  if (error) throw error
  return data.signedUrl
}

/** Fetch a short-lived signed URL for a private chat-image path.
 *  Only succeeds for callers who pass the storage SELECT policy (thread participants).
 *  staleTime is 50 min — well within the 60-min signed-URL expiry. */
export function useSignedImageUrl(path: string | null) {
  return useQuery({
    queryKey: ['chat-image', path],
    queryFn: () =>
      supabase.storage.from('chat-images').createSignedUrl(path!, 3600).then(r => {
        if (r.error) throw r.error
        return r.data.signedUrl
      }),
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
  })
}

/** Share a scheduled workout into the athlete's thread (hybrid: snapshot in
 *  payload for display + workout_id linking the live row for click-through). */
export async function shareWorkoutToChat(client: SupabaseClient, athleteId: string, w: Workout): Promise<void> {
  const thread = await fetchThread(client, athleteId)
  const { data: me } = await client.auth.getUser()
  const payload = { date: w.date, type: w.type, title: w.title, dist: w.dist, pace: w.pace }
  const { error } = await client.from('messages')
    .insert({ thread_id: thread.id, from_user_id: me.user!.id, kind: 'workout', workout_id: w.id, payload })
  if (error) throw error
}
export function useShareWorkout(athleteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (w: Workout) => shareWorkoutToChat(supabase, athleteId, w),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  })
}

/** Post a workout-change notification (kind='adjust') so the athlete sees the edit. */
export async function shareAdjustToChat(client: SupabaseClient, athleteId: string, from: string, to: string, reason = ''): Promise<void> {
  const thread = await fetchThread(client, athleteId)
  const { data: me } = await client.auth.getUser()
  const { error } = await client.from('messages')
    .insert({ thread_id: thread.id, from_user_id: me.user!.id, kind: 'adjust', payload: { from, to, reason } })
  if (error) throw error
}
export function useShareAdjust(athleteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { from: string; to: string; reason?: string }) => shareAdjustToChat(supabase, athleteId, v.from, v.to, v.reason),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
  })
}

/** Mark this thread read for me (chat: last_read_at; team: per-message flag). */
export async function markThreadRead(client: SupabaseClient, threadId: string): Promise<void> {
  const { error } = await client.rpc('mark_thread_read', { p_thread: threadId })
  if (error) throw error
}
export function useMarkThreadRead(threadId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => markThreadRead(supabase, threadId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['messages', threadId] })
      qc.invalidateQueries({ queryKey: ['unread'] })
      qc.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}

/** Unread message counts per athlete for the signed-in coach (badge data). */
export async function fetchUnreadCounts(client: SupabaseClient): Promise<Record<string, number>> {
  const { data, error } = await client.rpc('unread_message_counts')
  if (error) throw error
  const map: Record<string, number> = {}
  for (const r of (data as { athlete_id: string; unread: number }[])) map[r.athlete_id] = r.unread
  return map
}
export function useUnreadCounts() {
  return useQuery({ queryKey: ['unread'], queryFn: () => fetchUnreadCounts(supabase) })
}
/** Refresh unread badges live as messages arrive / are read anywhere. */
export function useUnreadRealtime() {
  const qc = useQueryClient()
  useEffect(() => {
    const ch = supabase.channel(uniqueTopic('unread'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' },
        () => qc.invalidateQueries({ queryKey: ['unread'] }))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [qc])
}

/** Stream new messages for a thread into the cache. */
export function useRealtimeThread(threadId: string | null) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!threadId) return
    const ch = supabase.channel(uniqueTopic(`messages:${threadId}`))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` },
        () => qc.invalidateQueries({ queryKey: ['messages', threadId] }))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [threadId, qc])
}
