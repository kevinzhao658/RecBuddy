import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { admin, makeCoach } from '../../test/helpers'
import { reportContent, blockUser, fetchBlockedUsers } from './moderation'
import { startConversation } from './conversations'

const URL = process.env.SUPABASE_URL!, ANON = process.env.SUPABASE_ANON_KEY!

describe('coach-web moderation', () => {
  let coach: any, athleteId: string, threadId: string, msgId: string

  beforeAll(async () => {
    const c = await makeCoach('Mod Coach')
    coach = createClient(URL, ANON, { auth: { persistSession: false } })
    await coach.auth.signInWithPassword({ email: c.email, password: c.password })
    const { data: u } = await admin().auth.admin.createUser({ email: `mod-${c.id}@test.recbuddy.app`, password: 'pw1234', email_confirm: true, user_metadata: { name: 'Mod Athlete' } })
    athleteId = u.user!.id
    await admin().from('coach_athlete').insert({ coach_id: c.id, athlete_id: athleteId, relationship: 'head' })
    threadId = await startConversation(coach, [athleteId], null)
    const { data: m } = await admin().from('messages').insert({ thread_id: threadId, from_user_id: athleteId, kind: 'text', body: 'something rude' }).select().single()
    msgId = m!.id
  })

  it('a coach reports an athlete message and it lands in content_reports with a snapshot', async () => {
    await reportContent(coach, { reason: 'harassment', messageId: msgId, details: 'from coach web' })
    const { data } = await admin().from('content_reports').select('reported_user_id, reason, content_snapshot').eq('message_id', msgId).single()
    expect(data!.reported_user_id).toBe(athleteId)
    expect(data!.content_snapshot.body).toBe('something rude')
  })

  it('a coach blocks the athlete: listed as blocked, link severed, 1:1 closed to them', async () => {
    await blockUser(coach, athleteId)
    expect((await fetchBlockedUsers(coach)).map((u) => u.user_id)).toEqual([athleteId])
    const { data: link } = await admin().from('coach_athlete').select('coach_id').eq('athlete_id', athleteId)
    expect(link).toEqual([])
    const { data: mem } = await admin().from('thread_members').select('status').eq('thread_id', threadId).eq('user_id', athleteId).single()
    expect(mem!.status).toBe('removed')
  })
})
