import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Permanently delete the CALLER's own account. Authenticated (verify_jwt is on):
// the platform checks the JWT before we run; we then re-verify the password
// server-side so a hijacked session alone can't destroy an account. Deleting the
// auth user cascades through profiles to all owned rows (roster links, plans by
// athlete_id are untouched — athletes keep their training data).
const GENERIC = 'Could not delete the account. Please try again.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const { password } = await req.json()
    if (!password) return json({ error: 'password is required' }, 400)

    // Resolve the caller from their JWT.
    const caller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } }, auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { data: u, error: uErr } = await caller.auth.getUser()
    if (uErr || !u.user?.email) return json({ error: 'Not signed in.' }, 401)

    // Re-verify the password (fresh sign-in on a throwaway client).
    const check = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { error: pwErr } = await check.auth.signInWithPassword({ email: u.user.email, password })
    if (pwErr) return json({ error: 'Password is incorrect.' }, 403)

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )
    const { error: delErr } = await admin.auth.admin.deleteUser(u.user.id)
    if (delErr) { console.error('delete-account', delErr); return json({ error: GENERIC }, 500) }

    return json({ ok: true }, 200)
  } catch (e) {
    console.error('delete-account', e)
    return json({ error: GENERIC }, 400)
  }
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
