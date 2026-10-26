import { createClient } from 'jsr:@supabase/supabase-js@2'
import { purgeExpiredVideos } from './purge.ts'

// Called daily by pg_cron (migration 20261024120000) with the service-role key.
Deno.serve(async (req) => {
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  if (req.headers.get('authorization') !== `Bearer ${key}`) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } })
  }
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, key, { auth: { autoRefreshToken: false, persistSession: false } })
  try {
    const purged = await purgeExpiredVideos(admin)
    return new Response(JSON.stringify({ purged }), { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    console.error('purge-chat-videos', e)
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
})
