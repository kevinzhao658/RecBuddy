import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { admin, anon, createAndSignIn } from './helpers'

describe('create_invite RPC', () => {
  let coach: any, athlete: any
  beforeAll(async () => {
    coach = await createAndSignIn({ role: 'coach', name: 'Inviter Coach', title: 'Head Coach' })
    athlete = await createAndSignIn({ role: 'athlete', name: 'Recruit' })
  })

  it('returns a code owned by the calling coach', async () => {
    const { data: code, error } = await coach.client.rpc('create_invite', { p_athlete_name: 'New Athlete' })
    expect(error).toBeNull()
    expect(typeof code).toBe('string')
    expect((code as string).length).toBe(8)
    const row = await admin().from('invites').select('*').eq('code', code).single()
    expect(row.data!.coach_id).toBe(coach.id)
    expect(row.data!.athlete_name).toBe('New Athlete')
  })

  it('the returned code is redeemable end-to-end', async () => {
    const { data: code } = await coach.client.rpc('create_invite', { p_athlete_name: 'E2E' })
    const { error } = await athlete.client.rpc('redeem_invite', { p_code: code })
    expect(error).toBeNull()
    const link = await admin().from('coach_athlete').select('*').eq('coach_id', coach.id).eq('athlete_id', athlete.id).single()
    expect(link.data!.relationship).toBe('head')
  })

  it('anon cannot create invites', async () => {
    const { error } = await anon().rpc('create_invite', { p_athlete_name: 'x' })
    expect(error).not.toBeNull()
  })
})
