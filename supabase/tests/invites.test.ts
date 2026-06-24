import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, createAndSignIn, anon } from './helpers'

describe('invite flow', () => {
  let coach: any
  // Unique codes per run so the suite is re-runnable without a db reset
  // (invites.code has a UNIQUE constraint and there is no per-test cleanup).
  const okCode = `CODE-OK-${randomUUID()}`
  const redeemCode = `CODE-REDEEM-${randomUUID()}`

  beforeAll(async () => {
    coach = await createAndSignIn({ role: 'coach', name: 'Inviting Coach', title: 'Head Coach' })
  })

  it('coach creates an invite for their own coach_id only', async () => {
    const ok = await coach.client.from('invites').insert({ code: okCode, coach_id: coach.id, athlete_name: 'New Athlete' }).select()
    expect(ok.error).toBeNull()
    const bad = await coach.client.from('invites').insert({ code: `CODE-BAD-${randomUUID()}`, coach_id: '00000000-0000-0000-0000-000000000000' }).select()
    expect(bad.error).not.toBeNull() // with check (coach_id = auth.uid())
  })

  it('resolve_invite returns coach display info for a valid code (anon-callable)', async () => {
    const { data, error } = await anon().rpc('resolve_invite', { p_code: okCode })
    expect(error).toBeNull()
    expect(data!.length).toBe(1)
    expect(data![0].coach_name).toBe('Inviting Coach')
    expect(data![0].coach_initials).toBe('IC')
  })

  it('resolve_invite returns nothing for an unknown code', async () => {
    const { data } = await anon().rpc('resolve_invite', { p_code: `NOPE-${randomUUID()}` })
    expect(data!.length).toBe(0)
  })

  it('athlete redeems a code: links to coach as head + marks consumed', async () => {
    await coach.client.from('invites').insert({ code: redeemCode, coach_id: coach.id })
    const athlete = await createAndSignIn({ role: 'athlete', name: 'Joining Athlete' })
    const { error } = await athlete.client.rpc('redeem_invite', { p_code: redeemCode })
    expect(error).toBeNull()
    // link exists, relationship = head
    const link = await admin().from('coach_athlete').select('*').eq('coach_id', coach.id).eq('athlete_id', athlete.id).single()
    expect(link.data!.relationship).toBe('head')
    // code now consumed -> resolve returns nothing
    const resolved = await anon().rpc('resolve_invite', { p_code: redeemCode })
    expect(resolved.data!.length).toBe(0)
    // second redeem fails cleanly
    const second = await athlete.client.rpc('redeem_invite', { p_code: redeemCode })
    expect(second.error).not.toBeNull()
  })
})
