import { createClient } from 'jsr:@supabase/supabase-js@2'
import { push } from '../notify-message/apns.ts'
import { reactionAlert, notifyReactionAuthor } from '../notify-message/recipients.ts'

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
  if (!msg) return new Response('skip')
  const author = msg.from_user_id

  // Lookup failures retry (5xx) rather than fail open.
  const { data: thread, error: tErr } = await supa.from('message_threads').select('kind, athlete_id').eq('id', msg.thread_id).maybeSingle()
  if (tErr) { console.error('thread query', tErr); return new Response('retry', { status: 500 }) }
  const { data: member, error: mErr } = await supa.from('thread_members').select('status')
    .eq('thread_id', msg.thread_id).eq('user_id', author).maybeSingle()
  if (mErr) { console.error('member query', mErr); return new Response('retry', { status: 500 }) }
  const { data: block, error: bErr } = await supa.from('user_blocks').select('blocker_id')
    .eq('blocker_id', author).eq('blocked_id', record.user_id).maybeSingle()
  if (bErr) { console.error('block query', bErr); return new Response('retry', { status: 500 }) }
  // Team thread: the author must still be the athlete or one of their coaches,
  // and not blocked by the athlete.
  let authorCanRead = false
  if (thread?.kind === 'team' && thread.athlete_id) {
    const { data: link, error: lErr } = await supa.from('coach_athlete').select('coach_id')
      .eq('athlete_id', thread.athlete_id).eq('coach_id', author).maybeSingle()
    const { data: ab, error: abErr } = await supa.from('user_blocks').select('blocker_id')
      .eq('blocker_id', thread.athlete_id).eq('blocked_id', author).maybeSingle()
    if (lErr || abErr) { console.error('team access query', lErr ?? abErr); return new Response('retry', { status: 500 }) }
    authorCanRead = author === thread.athlete_id || (!!link && !ab)
  }
  if (!thread || !notifyReactionAuthor({ kind: thread.kind, authorStatus: member?.status ?? null, author,
                                         reactor: record.user_id, authorBlockedReactor: !!block, authorCanRead })) {
    return new Response('skip')
  }

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
