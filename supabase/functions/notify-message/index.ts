import { createClient } from 'jsr:@supabase/supabase-js@2'
import { push } from './apns.ts'
import { recipients, chatAlert, type ThreadInfo, type Member } from './recipients.ts'

// ── preview: message kind -> notification content (pure; mirrors the spec table) ──
export function preview(kind: string, body: string | null, payload: Record<string, unknown> | null, coach: string) {
  switch (kind) {
    case 'image':   return { title: coach, body: 'Sent a photo' }
    case 'workout': return { title: coach, body: `Shared a workout: ${payload?.title ?? 'workout'}` }
    case 'adjust':  return { title: coach, body: `Adjusted your plan: ${payload?.from ?? ''} → ${payload?.to ?? ''}` }
    default:        return { title: coach, body: (body ?? '').slice(0, 120) || 'New message' }
  }
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }
  let record: Record<string, unknown> & { thread_id?: string; from_user_id?: string; id?: string }
  try {
    ;({ record } = await req.json())
  } catch {
    console.error('notify-message: unparseable webhook body')
    return new Response('bad request', { status: 400 })
  }
  if (!record?.thread_id || !record.from_user_id) return new Response('no record', { status: 400 })
  const from = record.from_user_id

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Query FAILURE -> 5xx so the webhook retries; genuine not-found -> 200 skip.
  const { data: thread, error: threadErr } = await supa.from('message_threads')
    .select('kind, athlete_id, title').eq('id', record.thread_id).maybeSingle()
  if (threadErr) { console.error('thread query', threadErr); return new Response('retry', { status: 500 }) }
  if (!thread) return new Response('skip')

  let members: Member[] = []
  if (thread.kind === 'chat') {
    const { data, error } = await supa.from('thread_members').select('user_id, status').eq('thread_id', record.thread_id)
    if (error) { console.error('members query', error); return new Response('retry', { status: 500 }) }
    members = data ?? []
  }
  let to = recipients(thread as ThreadInfo, members, from)
  if (to.length === 0) return new Response('skip')

  // Nobody gets pushed a message from someone they blocked.
  const { data: blockers } = await supa.from('user_blocks').select('blocker_id').eq('blocked_id', from).in('blocker_id', to)
  const blocked = new Set((blockers ?? []).map((b) => b.blocker_id))
  to = to.filter((id) => !blocked.has(id))
  if (to.length === 0) return new Response('skip')

  const { data: sender } = await supa.from('profiles').select('name').eq('id', from).maybeSingle()
  const senderName = sender?.name ?? 'Your coach'
  const alert = chatAlert(thread as ThreadInfo, senderName,
    preview(record.kind as string, record.body as string | null, record.payload as Record<string, unknown> | null, senderName))

  const { data: tokens, error: tokenErr } = await supa.from('device_tokens').select('user_id, token, env').in('user_id', to)
  if (tokenErr) { console.error('token query', tokenErr); return new Response('retry', { status: 500 }) }

  // Per-token failures never abort the loop or fail the request — a webhook
  // retry would duplicate pushes to the tokens that already succeeded.
  for (const t of tokens ?? []) {
    try {
      if (await push(t.token, t.env, alert, record.thread_id as string, record.id as string) === 'gone') {
        await supa.from('device_tokens').delete().eq('user_id', t.user_id).eq('token', t.token)
      }
    } catch (e) {
      console.error('push failed for token', t.token.slice(0, 8), e)
    }
  }
  return new Response('ok')
})
