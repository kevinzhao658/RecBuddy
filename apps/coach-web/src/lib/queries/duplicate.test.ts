import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { admin, makeCoach } from '../../test/helpers'
import { duplicateWeek } from './plan'
import { addDays } from '../week'

const URL = process.env.SUPABASE_URL!, ANON = process.env.SUPABASE_ANON_KEY!

describe('duplicateWeek', () => {
  let coach: any, athleteId: string
  beforeAll(async () => {
    const c = await makeCoach(); coach = createClient(URL, ANON, { auth: { persistSession: false } })
    await coach.auth.signInWithPassword({ email: c.email, password: c.password })
    const { data: code } = await coach.rpc('create_invite', { p_athlete_name: 'Dup' })
    const email = `dup-${c.id}@test.recbuddy.app`
    const { data: u } = await admin().auth.admin.createUser({ email, password: 'pw1234', email_confirm: true, user_metadata: { name: 'Dup' } })
    athleteId = u.user!.id
    const a = createClient(URL, ANON, { auth: { persistSession: false } }); await a.auth.signInWithPassword({ email, password: 'pw1234' }); await a.rpc('redeem_invite', { p_code: code })
    const { data: plan } = await admin().from('plans').insert({ athlete_id: athleteId }).select().single()
    await admin().from('workouts').insert({ plan_id: plan!.id, athlete_id: athleteId, date: '2026-09-07', type: 'easy', title: 'W1 Mon', dist: 4, pace: '9:00/mi', status: 'done', sets: [] })
  })
  it('copies the week into the next week (date + 7), status reset to planned', async () => {
    await duplicateWeek(coach, athleteId, '2026-09-07')
    const next = addDays('2026-09-07', 7)
    const { data } = await admin().from('workouts').select('*').eq('athlete_id', athleteId).eq('date', next).single()
    expect(data!.title).toBe('W1 Mon')
    expect(data!.status).toBe('planned') // reset, not 'done'
  })
})
