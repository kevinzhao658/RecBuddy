import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { admin, makeCoach } from '../../test/helpers'

const URL = process.env.SUPABASE_URL!, ANON = process.env.SUPABASE_ANON_KEY!
const signIn = async (email: string) => { const c = createClient(URL, ANON, { auth: { persistSession: false } }); await c.auth.signInWithPassword({ email, password: 'pw1234' }); return c as SupabaseClient }
async function makeAthlete(name: string) {
  const email = `${crypto.randomUUID()}@test.recbuddy.app`
  const { data: u } = await admin().auth.admin.createUser({ email, password: 'pw1234', email_confirm: true, user_metadata: { name } })
  return { id: u.user!.id, email, client: await signIn(email) }
}

describe('coach permissions', () => {
  let coach1: any, coach2: any, c1: SupabaseClient, c2: SupabaseClient, athlete: any, planId: string
  beforeAll(async () => {
    coach1 = await makeCoach('Head Admin'); c1 = await signIn(coach1.email)
    coach2 = await makeCoach('Co Coach'); c2 = await signIn(coach2.email)
    athlete = await makeAthlete('Perm Athlete')
    const { data: code1 } = await c1.rpc('create_invite', { p_athlete_name: 'Perm Athlete' })
    await athlete.client.rpc('redeem_invite', { p_code: code1 })  // coach1 = head -> admin
    const { data: code2 } = await c2.rpc('create_invite', { p_athlete_name: 'Perm Athlete' })
    await athlete.client.rpc('redeem_invite', { p_code: code2 })  // coach2 = assistant -> edit
    planId = (await admin().from('plans').select('id').eq('athlete_id', athlete.id).single()).data!.id
  })

  it('head=admin, co-coach=edit by default', async () => {
    const rows = await admin().from('coach_athlete').select('coach_id, permission').eq('athlete_id', athlete.id)
    const perm = Object.fromEntries(rows.data!.map((r) => [r.coach_id, r.permission]))
    expect(perm[coach1.id]).toBe('admin')
    expect(perm[coach2.id]).toBe('edit')
  })

  it('an edit coach can create a workout; RLS blocks a read coach', async () => {
    const okRow = { plan_id: planId, athlete_id: athlete.id, date: '2026-10-05', type: 'easy', title: 'By Edit', status: 'planned', sets: [] }
    expect((await c2.from('workouts').insert(okRow)).error).toBeNull()   // coach2 = edit
    // Athlete (always admin) demotes coach2 to read.
    await athlete.client.rpc('set_coach_permission', { p_coach_id: coach2.id, p_athlete_id: athlete.id, p_permission: 'read' })
    const blocked = await c2.from('workouts').insert({ ...okRow, date: '2026-10-06', title: 'Should Fail' })
    expect(blocked.error).not.toBeNull()                                  // read cannot write
    expect((await c2.from('workouts').select('id').eq('athlete_id', athlete.id)).data!.length).toBeGreaterThan(0) // but CAN read
  })

  it('a read coach can still participate in chat', async () => {
    const { data: thread } = await c2.from('message_threads').select('id').eq('athlete_id', athlete.id).limit(1).maybeSingle()
    const tid = thread?.id ?? (await c2.from('message_threads').insert({ athlete_id: athlete.id, coach_id: coach1.id }).select('id').single()).data!.id
    const sent = await c2.from('messages').insert({ thread_id: tid, from_user_id: coach2.id, kind: 'text', body: 'read coach can chat' })
    expect(sent.error).toBeNull()
  })

  it('only the athlete or an admin coach can change permissions', async () => {
    // coach2 is now 'read' -> not admin -> refused.
    const refused = await c2.rpc('set_coach_permission', { p_coach_id: coach1.id, p_athlete_id: athlete.id, p_permission: 'read' })
    expect(refused.error?.message).toMatch(/admin/i)
    // Athlete promotes coach2 to admin -> coach2 can now manage.
    await athlete.client.rpc('set_coach_permission', { p_coach_id: coach2.id, p_athlete_id: athlete.id, p_permission: 'admin' })
    const ok = await c2.rpc('set_coach_permission', { p_coach_id: coach2.id, p_athlete_id: athlete.id, p_permission: 'edit' })
    expect(ok.error).toBeNull()
  })

  it('get_team returns each coach permission', async () => {
    const { data } = await c1.rpc('get_team', { p_athlete_id: athlete.id })
    expect(data!.find((r: any) => r.coach_id === coach1.id).permission).toBe('admin')
    expect(data!.every((r: any) => ['read', 'edit', 'admin'].includes(r.permission))).toBe(true)
  })
})
