import { createClient } from 'jsr:@supabase/supabase-js@2'

// Admin console actions that need the service role: the Auth admin API (ban)
// or Storage (a reported photo). Caller must be signed in AND profiles.is_admin
// (checked here, server-side). Every action is written to admin_actions.
//
//   { action: 'delete_message', message_id, report_id?, note }
//   { action: 'suspend',   user_id, report_id?, note }
//   { action: 'unsuspend', user_id, note }
//   { action: 'delete_user', user_id, report_id?, note }   — permanent

const cors = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'content-type': 'application/json' } })

// ~100 years: Auth has no "forever" ban; unsuspend lifts it.
const BAN = '876000h'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  // Who is calling? (verify_jwt is on, but resolve the user from the token.)
  const jwt = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  const { data: caller } = await admin.auth.getUser(jwt)
  if (!caller?.user) return json({ error: 'not signed in' }, 401)
  const { data: me } = await admin.from('profiles').select('is_admin, suspended_at').eq('id', caller.user.id).single()
  if (!me?.is_admin || me.suspended_at) return json({ error: 'admin only' }, 403)

  let body: { action?: string; message_id?: string; user_id?: string; report_id?: string; note?: string }
  try { body = await req.json() } catch { return json({ error: 'bad request' }, 400) }
  const note = body.note?.trim() || null // optional

  const log = (action: string, target: string | null, details: Record<string, unknown> = {}) =>
    admin.from('admin_actions').insert({
      admin_id: caller.user.id, action, target_user_id: target, report_id: body.report_id ?? null,
      message_id: body.message_id ?? null, note, details,
    })

  switch (body.action) {
    case 'delete_message': {
      if (!body.message_id) return json({ error: 'message_id required' }, 400)
      const { data: m } = await admin.from('messages')
        .select('id, thread_id, from_user_id, kind, payload').eq('id', body.message_id).maybeSingle()
      if (!m) return json({ error: 'message not found (already deleted?)' }, 404)
      // payload.path is written by the sender: only delete a file in this
      // message's own thread folder that the sender themselves uploaded —
      // never one the message merely points at.
      const path = (m.payload as { path?: string } | null)?.path
      let ownFile = typeof path === 'string' && path.startsWith(`${m.thread_id}/`) && !path.includes('..')
      if (ownFile) {
        const { data: owner } = await admin.rpc('chat_image_owner', { p_path: path })
        ownFile = owner === m.from_user_id
      }
      if (m.kind === 'image' && path && !ownFile) console.error('refusing to delete foreign storage path', path)
      if (m.kind === 'image' && path && ownFile) {
        const { error } = await admin.storage.from('chat-images').remove([path])
        if (error) console.error('storage remove', error)
      }
      const { error } = await admin.from('messages').delete().eq('id', m.id)
      if (error) return json({ error: error.message }, 500)
      await log('delete_message', m.from_user_id, { kind: m.kind, photo_removed: Boolean(path && ownFile) })
      return json({ ok: true })
    }

    case 'suspend':
    case 'unsuspend': {
      if (!body.user_id) return json({ error: 'user_id required' }, 400)
      if (body.user_id === caller.user.id) return json({ error: 'you can\'t suspend yourself' }, 400)
      const suspend = body.action === 'suspend'
      const { error: banErr } = await admin.auth.admin.updateUserById(body.user_id, { ban_duration: suspend ? BAN : 'none' })
      if (banErr) return json({ error: banErr.message }, 500)
      const { error } = await admin.from('profiles')
        .update({ suspended_at: suspend ? new Date().toISOString() : null }).eq('id', body.user_id)
      if (error) return json({ error: error.message }, 500)
      // The reason lives in an admin-only table, not on the profile.
      const { error: rErr } = suspend
        ? await admin.from('suspension_reasons').upsert({ user_id: body.user_id, reason: note, updated_at: new Date().toISOString() })
        : await admin.from('suspension_reasons').delete().eq('user_id', body.user_id)
      if (rErr) console.error('suspension reason', rErr)
      await log(body.action, body.user_id)
      return json({ ok: true })
    }

    case 'delete_user': {
      // Permanent: removes the auth user, which cascades through their profile
      // and everything they own (same path as in-app account deletion).
      // Reports keep their saved message copies as evidence.
      if (!body.user_id) return json({ error: 'user_id required' }, 400)
      if (body.user_id === caller.user.id) return json({ error: 'you can\'t remove your own account here' }, 400)
      const { data: target } = await admin.from('profiles')
        .select('name, email, is_admin').eq('id', body.user_id).maybeSingle()
      if (!target) return json({ error: 'user not found (already removed?)' }, 404)
      if (target.is_admin) return json({ error: 'remove admin rights first — admins can\'t be removed here' }, 400)
      // Log first: target_user_id becomes null once the profile is gone, so the
      // name/email live on in details.
      await log('delete_user', body.user_id, { name: target.name, email: target.email })
      const { error } = await admin.auth.admin.deleteUser(body.user_id)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true })
    }

    default:
      return json({ error: 'unknown action' }, 400)
  }
})
