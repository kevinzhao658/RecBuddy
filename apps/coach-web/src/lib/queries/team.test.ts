import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { admin, makeCoach } from '../../test/helpers'
import { requestCoCoach, fetchPendingCoCoaches, fetchTeam, searchCoaches } from './team'
import { fetchMyLinkRequests, respondLinkRequest } from './linkRequests'

const URL = process.env.SUPABASE_URL!, ANON = process.env.SUPABASE_ANON_KEY!

describe('team queries', () => {
  let head: any, asstClient: any, athleteId: string, assistantId: string
  const assistantName = `Assistant ${randomUUID()}` // unique per run → search returns exactly this coach

  beforeAll(async () => {
    const h = await makeCoach('Head One'); head = createClient(URL, ANON, { auth: { persistSession: false } })
    await head.auth.signInWithPassword({ email: h.email, password: h.password })
    const asst = await makeCoach(assistantName); assistantId = asst.id
    asstClient = createClient(URL, ANON, { auth: { persistSession: false } })
    await asstClient.auth.signInWithPassword({ email: asst.email, password: asst.password })
    const { data: code } = await head.rpc('create_invite', { p_athlete_name: 'Teamed' })
    const email = `team-${h.id}@test.recbuddy.app`
    const { data: u } = await admin().auth.admin.createUser({ email, password: 'pw1234', email_confirm: true, user_metadata: { name: 'Teamed' } })
    athleteId = u.user!.id
    const a = createClient(URL, ANON, { auth: { persistSession: false } }); await a.auth.signInWithPassword({ email, password: 'pw1234' }); await a.rpc('redeem_invite', { p_code: code })
  })

  it('head asks a co-coach found via search; they join only after accepting', async () => {
    const found = await searchCoaches(head, assistantName)
    expect(found.some((c) => c.id === assistantId)).toBe(true)
    await requestCoCoach(head, { coachId: assistantId, athleteId })
    expect((await fetchTeam(head, athleteId)).some((m) => m.coach_id === assistantId)).toBe(false)
    expect((await fetchPendingCoCoaches(head, athleteId)).map((p) => p.coach_id)).toEqual([assistantId])

    const [req] = await fetchMyLinkRequests(asstClient)
    expect(req).toMatchObject({ kind: 'co_coach', athlete_id: athleteId, athlete_name: 'Teamed' })
    await respondLinkRequest(asstClient, req.id, true)
    const team = await fetchTeam(head, athleteId)
    expect(team.some((m) => m.coach_id === assistantId && m.relationship === 'assistant')).toBe(true)
    expect(await fetchPendingCoCoaches(head, athleteId)).toEqual([])
  })
})
