import { describe, it, expect, beforeAll } from 'vitest'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { admin, makeCoach } from '../../test/helpers'

const URL = process.env.SUPABASE_URL!, ANON = process.env.SUPABASE_ANON_KEY!

/** Create a confirmed athlete signed-in client. */
async function makeAthlete(name: string) {
  const email = `${crypto.randomUUID()}@test.recbuddy.app`
  const { data: u } = await admin().auth.admin.createUser({ email, password: 'pw1234', email_confirm: true, user_metadata: { name } })
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  await c.auth.signInWithPassword({ email, password: 'pw1234' })
  return { id: u.user!.id, email, client: c as SupabaseClient }
}
const signIn = async (email: string) => { const c = createClient(URL, ANON, { auth: { persistSession: false } }); await c.auth.signInWithPassword({ email, password: 'pw1234' }); return c as SupabaseClient }

describe('additional coaches', () => {
  let coach1: any, coach2: any, c1: SupabaseClient, c2: SupabaseClient, athlete: any
  beforeAll(async () => {
    coach1 = await makeCoach('Coach One'); c1 = await signIn(coach1.email)
    coach2 = await makeCoach('Coach Two'); c2 = await signIn(coach2.email)
    athlete = await makeAthlete('Jordan Lee')
    // Coach1 invites with a goal -> athlete redeems: first coach = head, plan seeded.
    const { data: code1 } = await c1.rpc('create_invite', { p_athlete_name: 'Jordan Lee', p_goal_race: 'Original Half', p_goal_distance: '13.1 mi' })
    await athlete.client.rpc('redeem_invite', { p_code: code1 })
  })

  it('a second coach code joins as co-coach and does NOT overwrite the plan', async () => {
    const { data: code2 } = await c2.rpc('create_invite', { p_athlete_name: 'Jordan Lee', p_goal_race: 'Different Marathon', p_goal_distance: '26.2 mi' })
    await athlete.client.rpc('redeem_invite', { p_code: code2 })
    const links = await admin().from('coach_athlete').select('coach_id, relationship').eq('athlete_id', athlete.id)
    const byCoach = Object.fromEntries(links.data!.map((r) => [r.coach_id, r.relationship]))
    expect(byCoach[coach1.id]).toBe('head')
    expect(byCoach[coach2.id]).toBe('assistant')       // co-coach, not a second head
    const plan = await admin().from('plans').select('goal_race').eq('athlete_id', athlete.id).single()
    expect(plan.data!.goal_race).toBe('Original Half')  // untouched by coach2's invite goal
  })

  it('search_athletes matches by name and by exact email, hiding the email', async () => {
    const byName = await c1.rpc('search_athletes', { p_query: 'Jordan' })
    expect(byName.data!.some((r: any) => r.id === athlete.id)).toBe(true)
    expect(byName.data![0]).not.toHaveProperty('email')
    const byEmail = await c1.rpc('search_athletes', { p_query: athlete.email })
    expect(byEmail.data!.some((r: any) => r.id === athlete.id)).toBe(true)
    expect(byName.data!.find((r: any) => r.id === athlete.id).already_on_roster).toBe(true)
  })

  it('coach_add_athlete adds an existing athlete as co-coach; head is refused when one exists', async () => {
    const solo = await makeAthlete('Solo Runner') // no coach yet
    // A third coach adds them directly.
    const coach3 = await makeCoach('Coach Three'); const c3 = await signIn(coach3.email)
    await c3.rpc('coach_add_athlete', { p_athlete_id: solo.id, p_relationship: 'assistant' })
    const link = await admin().from('coach_athlete').select('relationship').eq('athlete_id', solo.id).eq('coach_id', coach3.id).single()
    expect(link.data!.relationship).toBe('assistant')

    // coach2 already-head-less on Jordan tries to take head -> refused (coach1 is head).
    const asHead = await c2.rpc('coach_add_athlete', { p_athlete_id: athlete.id, p_relationship: 'head' })
    expect(asHead.error?.message).toMatch(/already has a head coach/i)
  })

  it('search_coaches matches an exact email', async () => {
    const res = await c1.rpc('search_coaches', { p_query: coach2.email })
    expect(res.data!.some((r: any) => r.id === coach2.id)).toBe(true)
  })
})
