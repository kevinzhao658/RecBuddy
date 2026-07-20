import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { admin, makeCoach } from '../../test/helpers'
import { saveWorkout } from './plan'

const URL = process.env.SUPABASE_URL!, ANON = process.env.SUPABASE_ANON_KEY!

describe('saveWorkout (get-or-create plan)', () => {
  let coach: any, athleteId: string
  beforeAll(async () => {
    const c = await makeCoach(); coach = createClient(URL, ANON, { auth: { persistSession: false } })
    await coach.auth.signInWithPassword({ email: c.email, password: c.password })
    const { data: code } = await coach.rpc('create_invite', { p_athlete_name: 'No Plan' })
    const email = `noplan-${c.id}@test.recbuddy.app`
    const { data: u } = await admin().auth.admin.createUser({ email, password: 'pw1234', email_confirm: true, user_metadata: { name: 'No Plan' } })
    athleteId = u.user!.id
    const a = createClient(URL, ANON, { auth: { persistSession: false } })
    await a.auth.signInWithPassword({ email, password: 'pw1234' }); await a.rpc('redeem_invite', { p_code: code })
    // redeem_invite auto-seeds a plan from the invite goal — delete it so this
    // suite genuinely starts plan-less and exercises getOrCreatePlanId's CREATE.
    await admin().from('plans').delete().eq('athlete_id', athleteId)
  })

  it('creates the plan on first save, then writes the workout', async () => {
    const before = await admin().from('plans').select('id').eq('athlete_id', athleteId)
    expect(before.data!.length).toBe(0) // no plan yet
    await saveWorkout(coach, athleteId, '2026-09-07', {
      type: 'easy', title: 'First Run', dist: 3, pace: '10:00/mi', est_minutes: null, dur: null, note: '', sets: [],
    })
    const after = await admin().from('plans').select('id').eq('athlete_id', athleteId)
    expect(after.data!.length).toBe(1) // plan created
    const w = await admin().from('workouts').select('*').eq('athlete_id', athleteId).eq('date', '2026-09-07').single()
    expect(w.data!.title).toBe('First Run')
    expect(w.data!.status).toBe('planned')
  })

  it('reuses the existing plan on the next save (no duplicate plan)', async () => {
    await saveWorkout(coach, athleteId, '2026-09-08', {
      type: 'rest', title: 'Rest Day', dist: null, pace: null, est_minutes: null, dur: null, note: '', sets: [],
    })
    const plans = await admin().from('plans').select('id').eq('athlete_id', athleteId)
    expect(plans.data!.length).toBe(1) // still exactly one plan
    const rest = await admin().from('workouts').select('status').eq('athlete_id', athleteId).eq('date', '2026-09-08').single()
    expect(rest.data!.status).toBe('rest')
  })

  it('updates the addressed row when a workoutId is given (no new row)', async () => {
    const { data: w } = await admin().from('workouts').select('id').eq('athlete_id', athleteId).eq('date', '2026-09-07').single()
    await saveWorkout(coach, athleteId, '2026-09-07', {
      type: 'tempo', title: 'Retitled Tempo', dist: 5, pace: '8:00/mi', est_minutes: null, dur: null, note: '', sets: [],
    }, w!.id)
    const rows = await admin().from('workouts').select('id,title').eq('athlete_id', athleteId).eq('date', '2026-09-07')
    expect(rows.data!.length).toBe(1) // updated in place, not appended
    expect(rows.data![0].title).toBe('Retitled Tempo')
  })

  it('saving without a workoutId appends a second workout to the same day', async () => {
    await saveWorkout(coach, athleteId, '2026-09-07', {
      type: 'easy', title: 'Evening Shakeout', dist: 2, pace: '10:00/mi', est_minutes: null, dur: null, note: '', sets: [],
    })
    const rows = await admin().from('workouts').select('title').eq('athlete_id', athleteId).eq('date', '2026-09-07')
    expect(rows.data!.map((r) => r.title).sort()).toEqual(['Evening Shakeout', 'Retitled Tempo'])
  })
})
