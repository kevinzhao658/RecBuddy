import { createClient } from 'jsr:@supabase/supabase-js@2'

// ── preview: message kind -> notification content (pure; mirrors the spec table) ──
export function preview(kind: string, body: string | null, payload: Record<string, unknown> | null, coach: string) {
  switch (kind) {
    case 'image':   return { title: coach, body: 'Sent a photo' }
    case 'workout': return { title: coach, body: `Shared a workout: ${payload?.title ?? 'workout'}` }
    case 'adjust':  return { title: coach, body: `Adjusted your plan: ${payload?.from ?? ''} → ${payload?.to ?? ''}` }
    default:        return { title: coach, body: (body ?? '').slice(0, 120) || 'New message' }
  }
}

// ── APNs ES256 JWT, cached under Apple's 20–60 min window ──
let cached: { jwt: string; at: number } | null = null
const b64url = (s: string) => s.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function apnsJwt(): Promise<string> {
  if (cached && Date.now() - cached.at < 50 * 60 * 1000) return cached.jwt
  const pem = Deno.env.get('APNS_P8')!.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const header = b64url(btoa(JSON.stringify({ alg: 'ES256', kid: Deno.env.get('APNS_KEY_ID') })))
  const claims = b64url(btoa(JSON.stringify({ iss: Deno.env.get('APNS_TEAM_ID'), iat: Math.floor(Date.now() / 1000) })))
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(`${header}.${claims}`)))
  const jwt = `${header}.${claims}.${b64url(btoa(String.fromCharCode(...sig)))}`
  cached = { jwt, at: Date.now() }
  return jwt
}

/** Send one alert; 'gone' means the token is dead and should be deleted. */
async function push(token: string, env: string, alert: { title: string; body: string },
                    threadId: string, messageId: string): Promise<'ok' | 'gone' | 'error'> {
  const host = env === 'sandbox' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com'
  const res = await fetch(`https://${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${await apnsJwt()}`,
      'apns-topic': Deno.env.get('APNS_TOPIC')!,
      'apns-push-type': 'alert',
      'apns-priority': '10',
    },
    body: JSON.stringify({
      aps: { alert, sound: 'default', 'thread-id': threadId, category: 'COACH_MESSAGE' },
      thread_id: threadId,
      message_id: messageId,
    }),
  })
  if (res.ok) return 'ok'
  const detail = await res.text().catch(() => '')
  console.error('apns', res.status, detail)
  return res.status === 410 || detail.includes('BadDeviceToken') ? 'gone' : 'error'
}

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }
  const { record } = await req.json()
  if (!record?.thread_id) return new Response('no record', { status: 400 })

  const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: thread } = await supa.from('message_threads')
    .select('athlete_id, coach_id').eq('id', record.thread_id).single()
  // Athlete-only pushes: skip anything the athlete sent.
  if (!thread || record.from_user_id === thread.athlete_id) return new Response('skip')

  const { data: coach } = await supa.from('profiles').select('name').eq('id', record.from_user_id).single()
  const alert = preview(record.kind, record.body, record.payload, coach?.name ?? 'Your coach')

  const { data: tokens } = await supa.from('device_tokens').select('token, env').eq('user_id', thread.athlete_id)
  for (const t of tokens ?? []) {
    if (await push(t.token, t.env, alert, record.thread_id, record.id) === 'gone') {
      await supa.from('device_tokens').delete().eq('user_id', thread.athlete_id).eq('token', t.token)
    }
  }
  return new Response('ok')
})
