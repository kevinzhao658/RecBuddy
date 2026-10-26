// APNs sender shared by notify-message and notify-reaction.

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
export async function push(token: string, env: string, alert: { title: string; body: string },
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
