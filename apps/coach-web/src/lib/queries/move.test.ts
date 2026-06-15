import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { admin, makeCoach } from '../../test/helpers'
import { moveWorkout } from './plan'

const URL = process.env.SUPABASE_URL!, ANON = process.env.SUPABASE_ANON_KEY!

describe('moveWorkout', () => {
  let coach: any, athleteId: string, planId: string
  beforeAll(async () => {
    const c = await makeCoach(); coach = createClient(URL, ANON, { auth: { persistSession: false } })
    await coach.auth.signInWithPassword({ email: c.email, password: c.password })
    const { data: code } = await coach.rpc('create_invite', { p_athlete_name: 'Mover' })
    const email = `mover-${c.id}@test.recbuddy.app`
    const { data: u } = await admin().auth.admin.createUser({ email, password: 'pw1234', email_confirm: true, user_metadata: { name: 'Mover' } })
    athleteId = u.user!.id
    const a = createClient(URL, ANON, { auth: { persistSession: false } })
    await a.auth.signInWithPassword({ email, password: 'pw1234' }); await a.rpc('redeem_invite', { p_code: code })
    const { data: plan } = await admin().from('plans').insert({ athlete_id: athleteId }).select().single(); planId = plan!.id
    await admin().from('workouts').insert({ plan_id: planId, athlete_id: athleteId, date: '2026-09-07', type: 'easy', title: 'Move Me', dist: 4, pace: '9:00/mi', status: 'planned', sets: [] })
  })
  it('moves a workout to an empty day', async () => {
    await moveWorkout(coach, { athleteId, from: '2026-09-07', to: '2026-09-09' })
    const { data } = await admin().from('workouts').select('date,title').eq('athlete_id', athleteId)
    expect(data!.find((w) => w.title === 'Move Me')!.date).toBe('2026-09-09')
    expect(data!.length).toBe(1)
  })
  it('swaps when the target day is occupied', async () => {
    await admin().from('workouts').insert({ plan_id: planId, athlete_id: athleteId, date: '2026-09-10', type: 'long', title: 'Other', dist: 8, pace: '9:30/mi', status: 'planned', sets: [] })
    await moveWorkout(coach, { athleteId, from: '2026-09-09', to: '2026-09-10' })
    const { data } = await admin().from('workouts').select('date,title').eq('athlete_id', athleteId).order('date')
    // 'Move Me' now on 10th, 'Other' swapped back to 9th
    expect(data!.find((w) => w.date === '2026-09-10')!.title).toBe('Move Me')
    expect(data!.find((w) => w.date === '2026-09-09')!.title).toBe('Other')
  })
})
