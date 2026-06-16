import 'dotenv/config'
import { describe, it, expect } from 'vitest'
import { admin, createAndSignIn } from './helpers'

describe('coach-role authorization backstop', () => {
  it('an athlete cannot create an invite', async () => {
    const athlete = await createAndSignIn({ role: 'athlete', name: 'Sneaky Athlete' })
    const { error } = await athlete.client.rpc('create_invite', { p_athlete_name: 'x' })
    expect(error).not.toBeNull()
  })

  it('a non-coach with an injected coach_athlete row gets NO coach access', async () => {
    const attacker = await createAndSignIn({ role: 'athlete', name: 'Attacker' })
    const victim = await createAndSignIn({ role: 'athlete', name: 'Victim' })
    const sql = admin()
    const { data: plan } = await sql.from('plans').insert({ athlete_id: victim.id }).select().single()
    const { data: w } = await sql.from('workouts').insert({
      plan_id: plan!.id, athlete_id: victim.id, date: '2026-10-01', type: 'easy', title: 'Secret', status: 'planned', sets: [],
    }).select().single()
    // Inject the malicious link as if the attacker were a head coach (bypasses RLS via service role).
    await sql.from('coach_athlete').insert({ coach_id: attacker.id, athlete_id: victim.id, relationship: 'head' })
    // The attacker is an ATHLETE, so is_coach_of must NOT treat them as a coach:
    const wk = await attacker.client.from('workouts').select('*').eq('id', w!.id)
    expect(wk.data ?? []).toEqual([]) // cannot read victim's workout
    const prof = await attacker.client.from('profiles').select('*').eq('id', victim.id)
    expect(prof.data ?? []).toEqual([]) // cannot read victim's profile via the coach path
  })

  it('a real coach can still create an invite (no regression)', async () => {
    const coach = await createAndSignIn({ role: 'coach', name: 'Real Coach', title: 'Head Coach' })
    const { data, error } = await coach.client.rpc('create_invite', { p_athlete_name: 'New Athlete' })
    expect(error).toBeNull()
    expect(typeof data).toBe('string')
  })
})
