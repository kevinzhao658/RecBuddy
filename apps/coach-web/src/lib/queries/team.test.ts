import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'
import { admin, makeCoach } from '../../test/helpers'
import { addAssistant, fetchTeam, searchCoaches } from './team'

const URL = process.env.SUPABASE_URL!, ANON = process.env.SUPABASE_ANON_KEY!

describe('team queries', () => {
  let head: any, athleteId: string, assistantId: string
  const assistantName = `Assistant ${randomUUID()}` // unique per run → search returns exactly this coach

  beforeAll(async () => {
    const h = await makeCoach('Head One'); head = createClient(URL, ANON, { auth: { persistSession: false } })
    await head.auth.signInWithPassword({ email: h.email, password: h.password })
    const asst = await makeCoach(assistantName); assistantId = asst.id
    const { data: code } = await head.rpc('create_invite', { p_athlete_name: 'Teamed' })
    const email = `team-${h.id}@test.recbuddy.app`
    const { data: u } = await admin().auth.admin.createUser({ email, password: 'pw1234', email_confirm: true, user_metadata: { name: 'Teamed' } })
    athleteId = u.user!.id
    const a = createClient(URL, ANON, { auth: { persistSession: false } }); await a.auth.signInWithPassword({ email, password: 'pw1234' }); await a.rpc('redeem_invite', { p_code: code })
  })

  it('head can add an assistant found via search', async () => {
    const found = await searchCoaches(head, assistantName)
    expect(found.some((c) => c.id === assistantId)).toBe(true)
    await addAssistant(head, { coachId: assistantId, athleteId })
    const team = await fetchTeam(head, athleteId)
    expect(team.some((m) => m.coach_id === assistantId && m.relationship === 'assistant')).toBe(true)
  })
})
