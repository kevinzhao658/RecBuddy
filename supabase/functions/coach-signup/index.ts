import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const TITLES = ['Head Coach', 'Assistant Coach', 'Strength Coach', 'Physio']
// Defaults to Cloudflare's public TEST secret (always passes) so signup works
// with no setup; set TURNSTILE_SECRET_KEY to the real secret to enforce in prod.
const TURNSTILE_SECRET = Deno.env.get('TURNSTILE_SECRET_KEY') || '1x0000000000000000000000000000000AA'

async function captchaOk(token: string): Promise<boolean> {
  const form = new FormData()
  form.append('secret', TURNSTILE_SECRET)
  form.append('response', token ?? '')
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
  const out = await r.json().catch(() => ({ success: false }))
  return !!out.success
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { name, email, password, title, captchaToken } = await req.json()
    if (!name || !email || !password || !TITLES.includes(title)) {
      return json({ error: 'name, email, password, and a valid title are required' }, 400)
    }
    // Verify the human-check before doing any privileged work.
    if (!(await captchaOk(captchaToken))) {
      return json({ error: 'Captcha verification failed — please try again.' }, 400)
    }
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    // Do NOT auto-confirm. The user must verify ownership of this email via the
    // confirmation link (the client triggers it with auth.resend) before they
    // can sign in — this prevents creating usable accounts for unowned emails
    // (account squatting). Role is still assigned server-side below.
    const { data, error } = await admin.auth.admin.createUser({
      email, password, email_confirm: false, user_metadata: { name },
    })
    if (error) return json({ error: error.message }, 400)
    const { error: pErr } = await admin.from('profiles').update({ role: 'coach', title }).eq('id', data.user!.id)
    if (pErr) {
      await admin.auth.admin.deleteUser(data.user!.id)
      return json({ error: pErr.message }, 400)
    }
    return json({ id: data.user!.id }, 200)
  } catch (e) {
    return json({ error: String(e) }, 400)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
