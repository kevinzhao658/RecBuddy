import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { admin, makeCoach } from '../../test/helpers'
import { fetchRoster } from './roster'
import { fetchPendingInvites } from './invites'

const URL = process.env.SUPABASE_URL!, ANON = process.env.SUPABASE_ANON_KEY!

describe('roster queries', () => {
  let coachClient: any, coachId: string
  beforeAll(async () => {
    const c = await makeCoach('Roster Coach'); coachId = c.id
    coachClient = createClient(URL, ANON, { auth: { persistSession: false } })
    await coachClient.auth.signInWithPassword({ email: c.email, password: c.password })
    // a pending invite
    await coachClient.rpc('create_invite', { p_athlete_name: 'Pending Pat' })
    // a real athlete linked via redeem
    const { data: code } = await coachClient.rpc('create_invite', { p_athlete_name: 'Real Rita' })
    const ath = createClient(URL, ANON, { auth: { persistSession: false } })
    const email = `rita-${coachId}@test.recbuddy.app`
    const { data: u } = await admin().auth.admin.createUser({ email, password: 'pw1234', email_confirm: true, user_metadata: { name: 'Rita' } })
    await ath.auth.signInWithPassword({ email, password: 'pw1234' })
    await ath.rpc('redeem_invite', { p_code: code })
  })

  it('returns linked athletes', async () => {
    const roster = await fetchRoster(coachClient)
    expect(roster.some((r) => r.athlete.name === 'Rita')).toBe(true)
  })
  it('lists each athlete exactly once even when another coach also coaches them', async () => {
    // Rita (this coach's athlete) gets a SECOND coach (an assistant). RLS would
    // expose that row to the head coach too; fetchRoster must still return Rita once.
    const rita = (await fetchRoster(coachClient)).find((r) => r.athlete.name === 'Rita')!
    const asst = await makeCoach('Second Coach')
    await admin().from('coach_athlete').insert({ coach_id: asst.id, athlete_id: rita.athlete.id, relationship: 'assistant' })
    const roster = await fetchRoster(coachClient)
    expect(roster.filter((r) => r.athlete.id === rita.athlete.id)).toHaveLength(1)
  })
  it('returns only unconsumed invites as pending', async () => {
    const pending = await fetchPendingInvites(coachClient)
    expect(pending.some((i) => i.athlete_name === 'Pending Pat')).toBe(true)
    expect(pending.some((i) => i.athlete_name === 'Real Rita')).toBe(false) // consumed
  })
})
