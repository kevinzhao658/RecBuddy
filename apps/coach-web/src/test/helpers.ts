import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

// Integration tests need the backend keys, which live in the REPO-ROOT .env
// (not apps/coach-web). Load it explicitly relative to this file.
config({ path: new URL('../../../../.env', import.meta.url).pathname })

const SUPABASE_URL = process.env.SUPABASE_URL!
const ANON = process.env.SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const noPersist = { auth: { persistSession: false, autoRefreshToken: false } }
export const admin = () => createClient(SUPABASE_URL, SERVICE, noPersist)
export const anon = () => createClient(SUPABASE_URL, ANON, noPersist)

export async function makeCoach(name = 'Test Coach') {
  const email = `${randomUUID()}@test.recbuddy.app`
  const { data } = await admin().auth.admin.createUser({ email, password: 'pw1234', email_confirm: true, user_metadata: { name } })
  await admin().from('profiles').update({ role: 'coach', title: 'Head Coach' }).eq('id', data.user!.id)
  return { id: data.user!.id, email, password: 'pw1234' }
}
