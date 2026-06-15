import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, createAndSignIn, anon } from './helpers'

describe('access-model hardening (final-review fixes)', () => {
  let coachX: any, coachY: any, athlete: any, victim: any
  let athleteMsgId: string
  let victimWorkoutId: string

  beforeAll(async () => {
    coachX = await createAndSignIn({ role: 'coach', name: 'Coach X', title: 'Head Coach' })
    coachY = await createAndSignIn({ role: 'coach', name: 'Coach Y', title: 'Head Coach' })
    athlete = await createAndSignIn({ role: 'athlete', name: 'Athlete One' })
    victim = await createAndSignIn({ role: 'athlete', name: 'Victim Two' })
    const sql = admin()
    await sql.from('coach_athlete').insert({ coach_id: coachX.id, athlete_id: athlete.id, relationship: 'head' })
    const { data: t } = await sql.from('message_threads').insert({ athlete_id: athlete.id, coach_id: coachX.id }).select().single()
    const { data: am } = await sql.from('messages').insert({ thread_id: t!.id, from_user_id: athlete.id, kind: 'text', body: 'athlete original' }).select().single()
    athleteMsgId = am!.id
    const { data: vp } = await sql.from('plans').insert({ athlete_id: victim.id }).select().single()
    const { data: vw } = await sql.from('workouts').insert({ plan_id: vp!.id, athlete_id: victim.id, date: '2026-07-01', type: 'easy', title: 'Victim Run', status: 'planned' }).select().single()
    victimWorkoutId = vw!.id
  })

  it('a coach CANNOT self-link to an unrelated athlete as head (no invite bypass)', async () => {
    const { error } = await coachY.client.from('coach_athlete').insert({ coach_id: coachY.id, athlete_id: victim.id, relationship: 'head' }).select()
    expect(error).not.toBeNull()
    const link = await admin().from('coach_athlete').select('*').eq('coach_id', coachY.id).eq('athlete_id', victim.id)
    expect(link.data!.length).toBe(0)
  })

  it('a thread participant CANNOT rewrite message content, but CAN mark read', async () => {
    const tamper = await coachX.client.from('messages').update({ body: 'TAMPERED' }).eq('id', athleteMsgId).select()
    expect(tamper.error).not.toBeNull()
    const fresh = await admin().from('messages').select('body').eq('id', athleteMsgId).single()
    expect(fresh.data!.body).toBe('athlete original')
    const read = await coachX.client.from('messages').update({ read: true }).eq('id', athleteMsgId).select()
    expect(read.error).toBeNull()
    expect(read.data!.length).toBe(1)
  })

  it('an athlete CANNOT attach an actual to another athlete workout', async () => {
    const { error } = await athlete.client.from('workout_actuals').insert({
      workout_id: victimWorkoutId, athlete_id: athlete.id, dist: 3, source: 'manual',
    }).select()
    expect(error).not.toBeNull()
  })

  it('an athlete cannot end up with two head coaches via redeem', async () => {
    const code = `HEAD2-${randomUUID()}`
    await admin().from('invites').insert({ code, coach_id: coachY.id })
    const { error } = await athlete.client.rpc('redeem_invite', { p_code: code })
    expect(error).not.toBeNull() // already has a head coach
    const heads = await admin().from('coach_athlete').select('*').eq('athlete_id', athlete.id).eq('relationship', 'head')
    expect(heads.data!.length).toBe(1)
  })

  it('anon cannot execute redeem_invite or mark_workout_status (authenticated only)', async () => {
    const r1 = await anon().rpc('redeem_invite', { p_code: `x-${randomUUID()}` })
    expect(r1.error).not.toBeNull()
    expect(`${r1.error?.code ?? ''} ${r1.error?.message ?? ''}`.toLowerCase()).toMatch(/pgrst202|permission|could not find|denied/)
    const r2 = await anon().rpc('mark_workout_status', { p_workout_id: '00000000-0000-0000-0000-000000000000', p_status: 'done' })
    expect(r2.error).not.toBeNull()
    expect(`${r2.error?.code ?? ''} ${r2.error?.message ?? ''}`.toLowerCase()).toMatch(/pgrst202|permission|could not find|denied/)
  })
})
