import 'dotenv/config'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const URL = process.env.SUPABASE_URL!
const ANON = process.env.SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

const noPersist = { auth: { autoRefreshToken: false, persistSession: false } }

/** Service-role client: bypasses RLS. Use only for setup/teardown. */
export function admin(): SupabaseClient {
  return createClient(URL, SERVICE, noPersist)
}

/** Anonymous client: subject to RLS, no user. */
export function anon(): SupabaseClient {
  return createClient(URL, ANON, noPersist)
}

export type NewUser = {
  email?: string
  password?: string
  role: 'coach' | 'athlete'
  name: string
  experience_level?: string
  primary_goal?: string
  title?: string
}

/** Create an auth user via the admin API; the handle_new_user trigger creates
 *  the profile (always as 'athlete'). Coaches are then PROMOTED via a
 *  service-role update — the only path to the coach role. Returns the user id
 *  + the credentials used.
 *  SECURITY: role/title are never set from client-supplied signup metadata;
 *  only this service-role (admin) client can grant the coach role. */
export async function createUser(u: NewUser) {
  const email = u.email ?? `${randomUUID()}@test.recbuddy.app`
  const password = u.password ?? 'test-password-123'
  const { data, error } = await admin().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      name: u.name,
      experience_level: u.experience_level,
      primary_goal: u.primary_goal,
    },
  })
  if (error) throw error
  const id = data.user!.id
  if (u.role === 'coach') {
    const { error: pErr } = await admin()
      .from('profiles')
      .update({ role: 'coach', is_coach: true, title: u.title ?? null })
      .eq('id', id)
    if (pErr) throw pErr
  }
  return { id, email, password }
}

/** Sign in and return a user-scoped client (RLS applies as this user). */
export async function signIn(email: string, password: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON, noPersist)
  const { error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw error
  return client
}

/** Convenience: create a user and return a signed-in client + id. */
export async function createAndSignIn(u: NewUser) {
  const { id, email, password } = await createUser(u)
  const client = await signIn(email, password)
  return { id, email, client }
}

/** An admin coach adds a co-coach the only way clients can: request, then the
 *  added coach accepts. */
export async function addCoCoach(head: SupabaseClient, athleteId: string, coach: { id: string; client: SupabaseClient }) {
  const asked = await head.rpc('request_co_coach', { p_athlete_id: athleteId, p_coach_id: coach.id })
  if (asked.error) throw asked.error
  const { data } = await coach.client.rpc('my_link_requests')
  const req = (data ?? []).find((r: any) => r.athlete_id === athleteId)
  const ok = await coach.client.rpc('respond_link_request', { p_id: req.id, p_accept: true })
  if (ok.error) throw ok.error
}
