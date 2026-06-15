import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { admin, makeCoach } from '../../test/helpers'
import { fetchWeek } from './plan'
import { mondayOf } from '../week'

const URL = process.env.SUPABASE_URL!, ANON = process.env.SUPABASE_ANON_KEY!

describe('plan week query', () => {
  let coach: any, athleteId: string
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
    await admin().from('workouts').insert({ plan_id: plan!.id, athlete_id: athleteId, date: '2026-09-07', type: 'easy', title: 'Mon Easy', dist: 4, pace: '9:00/mi', status: 'planned', sets: [] })
  })
  it('returns workouts in the Mon–Sun window', async () => {
    const week = await fetchWeek(coach, athleteId, mondayOf('2026-09-07'))
    expect(week.find((w) => w?.date === '2026-09-07')?.title).toBe('Mon Easy')
    expect(week.length).toBe(7) // null for empty days
  })
})
