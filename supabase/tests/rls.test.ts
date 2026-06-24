import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { admin, createUser, createAndSignIn, signIn } from './helpers'

describe('RLS access rules', () => {
  let coach: { id: string; email: string; client: any }
  let other: { id: string; email: string; client: any }
  let athleteA: { id: string; email: string; client: any }
  let athleteB: { id: string; email: string; client: any }
  let planA: string
  let workoutA: string

  beforeAll(async () => {
    coach = await createAndSignIn({ role: 'coach', name: 'Coach A', title: 'Head Coach' })
    other = await createAndSignIn({ role: 'coach', name: 'Coach B', title: 'Head Coach' })
    athleteA = await createAndSignIn({ role: 'athlete', name: 'Athlete A' })
    athleteB = await createAndSignIn({ role: 'athlete', name: 'Athlete B' })

    const sql = admin()
    // coach A coaches athlete A (head); set up via service role
    await sql.from('coach_athlete').insert({ coach_id: coach.id, athlete_id: athleteA.id, relationship: 'head' })
    const { data: plan } = await sql.from('plans').insert({ athlete_id: athleteA.id, plan_week: 1, plan_weeks: 12 }).select().single()
    planA = plan!.id
    const { data: w } = await sql.from('workouts').insert({
      plan_id: planA, athlete_id: athleteA.id, date: '2026-06-01', type: 'easy', title: 'Easy Run', status: 'planned',
    }).select().single()
    workoutA = w!.id
  })

  it('athlete reads their own workout', async () => {
    const { data } = await athleteA.client.from('workouts').select('*').eq('id', workoutA)
    expect(data!.length).toBe(1)
  })

  it('athlete B cannot read athlete A workout', async () => {
    const { data } = await athleteB.client.from('workouts').select('*').eq('id', workoutA)
    expect(data!.length).toBe(0)
  })

  it('coach A reads their athlete workout; coach B cannot', async () => {
    const a = await coach.client.from('workouts').select('*').eq('id', workoutA)
    expect(a.data!.length).toBe(1)
    const b = await other.client.from('workouts').select('*').eq('id', workoutA)
    expect(b.data!.length).toBe(0)
  })

  it('coach A can write their athlete workout; coach B cannot', async () => {
    const ok = await coach.client.from('workouts').update({ title: 'Edited' }).eq('id', workoutA).select()
    expect(ok.data!.length).toBe(1)
    const denied = await other.client.from('workouts').update({ title: 'Hijacked' }).eq('id', workoutA).select()
    expect(denied.data!.length).toBe(0) // no row visible to update
  })

  it('assistant coach can read but cannot manage the roster (head-only)', async () => {
    const assistant = await createAndSignIn({ role: 'coach', name: 'Assistant', title: 'Assistant Coach' })
    // head coach adds the assistant to athlete A's team
    await admin().from('coach_athlete').insert({ coach_id: assistant.id, athlete_id: athleteA.id, relationship: 'assistant' })
    // assistant can read athlete A's workout
    const read = await assistant.client.from('workouts').select('*').eq('id', workoutA)
    expect(read.data!.length).toBe(1)
    // assistant tries to add ANOTHER assistant -> head-only policy denies it
    const newCoach = await createUser({ role: 'coach', name: 'Sneaky', title: 'Assistant Coach' })
    const denied = await assistant.client
      .from('coach_athlete')
      .insert({ coach_id: newCoach.id, athlete_id: athleteA.id, relationship: 'assistant' })
      .select()
    expect(denied.error).not.toBeNull()
  })

  it('coach library is private to its owner', async () => {
    await admin().from('library_workouts').insert({ coach_id: coach.id, type: 'easy', title: 'Easy 5' })
    const mine = await coach.client.from('library_workouts').select('*').eq('coach_id', coach.id)
    expect(mine.data!.length).toBeGreaterThan(0)
    const theirs = await other.client.from('library_workouts').select('*').eq('coach_id', coach.id)
    expect(theirs.data!.length).toBe(0)
  })

  it('an athlete cannot escalate their own role via a direct profile update', async () => {
    const before = await admin().from('profiles').select('role').eq('id', athleteB.id).single()
    expect(before.data!.role).toBe('athlete')
    const { error } = await athleteB.client.from('profiles').update({ role: 'coach' }).eq('id', athleteB.id)
    expect(error).not.toBeNull() // guard trigger raises
    const after = await admin().from('profiles').select('role').eq('id', athleteB.id).single()
    expect(after.data!.role).toBe('athlete') // unchanged
  })
})
