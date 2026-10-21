import { createClient } from 'jsr:@supabase/supabase-js@2'
import { push } from '../notify-message/apns.ts'
import { reactionAlert } from '../notify-message/recipients.ts'

// Database Webhook on message_reactions INSERT/UPDATE (dashboard-configured,
// same x-webhook-secret as notify-message). Pushes "Dani 👍 your message" to
// the message's author. Un-reactions (kind = null), self-reactions, and
// reactions from someone the author blocked are skipped.
Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }
  let record: { message_id?: string; user_id?: string; thread_id?: string; kind?: string | null }
  try {
    ;({ record } = await req.json())
  } catch {
    return new Response('bad request', { status: 400 })
  }
  if (!record?.message_id || !record.user_id) return new Response('no record', { status: 400 })
  if (!record.kind) return new Response('skip')

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: msg, error } = await supa.from('messages').select('from_user_id, thread_id').eq('id', record.message_id).maybeSingle()
  if (error) { console.error('message query', error); return new Response('retry', { status: 500 }) }
  if (!msg || msg.from_user_id === record.user_id) return new Response('skip')
  const author = msg.from_user_id

  const { data: block } = await supa.from('user_blocks').select('blocker_id')
    .eq('blocker_id', author).eq('blocked_id', record.user_id).maybeSingle()
  if (block) return new Response('skip')

  const { data: reactor } = await supa.from('profiles').select('name').eq('id', record.user_id).maybeSingle()
  const alert = reactionAlert(reactor?.name ?? 'Someone', record.kind)

  const { data: tokens, error: tokenErr } = await supa.from('device_tokens').select('token, env').eq('user_id', author)
  if (tokenErr) { console.error('token query', tokenErr); return new Response('retry', { status: 500 }) }
  for (const t of tokens ?? []) {
    try {
      if (await push(t.token, t.env, alert, msg.thread_id, record.message_id) === 'gone') {
        await supa.from('device_tokens').delete().eq('user_id', author).eq('token', t.token)
      }
    } catch (e) {
      console.error('push failed for token', t.token.slice(0, 8), e)
    }
  }
  return new Response('ok')
})
