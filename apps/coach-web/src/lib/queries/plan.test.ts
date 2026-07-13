import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { admin, makeCoach } from '../../test/helpers'
import { fetchWeek } from './plan'
import { mondayOf } from '../week'

const URL = process.env.SUPABASE_URL!, ANON = process.env.SUPABASE_ANON_KEY!

describe('plan week query', () => {
  let coach: any, athleteId: string, planId: string
  beforeAll(async () => {
    const c = await makeCoach(); coach = createClient(URL, ANON, { auth: { persistSession: false } })
    await coach.auth.signInWithPassword({ email: c.email, password: c.password })
    const { data: code } = await coach.rpc('create_invite', { p_athlete_name: 'Plan Athlete' })
    const a = createClient(URL, ANON, { auth: { persistSession: false } })
    const email = `plan-${c.id}@test.recbuddy.app`
    const { data: u } = await admin().auth.admin.createUser({ email, password: 'pw1234', email_confirm: true, user_metadata: { name: 'Plan Athlete' } })
    athleteId = u.user!.id
    await a.auth.signInWithPassword({ email, password: 'pw1234' }); await a.rpc('redeem_invite', { p_code: code })
    const { data: plan } = await admin().from('plans').insert({ athlete_id: athleteId, plan_week: 1, plan_weeks: 12 }).select().single()
    planId = plan!.id
    await admin().from('workouts').insert({ plan_id: planId, athlete_id: athleteId, date: '2026-09-07', type: 'easy', title: 'Mon Easy', dist: 4, pace: '9:00/mi', status: 'planned', sets: [] })
  })
  it('returns workouts grouped per day in the Mon–Sun window', async () => {
    const week = await fetchWeek(coach, athleteId, mondayOf('2026-09-07'))
    expect(week.length).toBe(7) // empty array for empty days
    expect(week[0].map((w) => w.title)).toEqual(['Mon Easy'])
    expect(week[1]).toEqual([])
  })
  it('groups multiple same-day workouts in created_at order', async () => {
    // Insert sequentially so created_at orders them deterministically.
    await admin().from('workouts').insert({ plan_id: planId, athlete_id: athleteId, date: '2026-09-08', type: 'easy', title: 'AM Shakeout', dist: 3, pace: '9:30/mi', status: 'planned', sets: [] })
    await admin().from('workouts').insert({ plan_id: planId, athlete_id: athleteId, date: '2026-09-08', type: 'speed', title: 'PM Track', dist: 5, pace: '7:30/mi', status: 'planned', sets: [] })
    const week = await fetchWeek(coach, athleteId, mondayOf('2026-09-07'))
    expect(week[1].map((w) => w.title)).toEqual(['AM Shakeout', 'PM Track'])
  })
})
