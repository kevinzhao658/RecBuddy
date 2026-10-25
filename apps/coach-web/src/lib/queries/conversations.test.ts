import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { admin, makeCoach } from '../../test/helpers'
import { fetchConversations, searchPeople, startConversation, fetchThreadPeople } from './conversations'
import { setReaction, fetchReactions } from './reactions'

const URL = process.env.SUPABASE_URL!, ANON = process.env.SUPABASE_ANON_KEY!

describe('conversation queries', () => {
  let coach: any, athleteId: string, athleteName: string

  beforeAll(async () => {
    const c = await makeCoach('Conv Coach')
    coach = createClient(URL, ANON, { auth: { persistSession: false } })
    await coach.auth.signInWithPassword({ email: c.email, password: c.password })
    athleteName = `Conv Athlete ${c.id.slice(0, 6)}`
    const { data: u } = await admin().auth.admin.createUser({ email: `conv-${c.id}@test.recbuddy.app`, password: 'pw1234', email_confirm: true, user_metadata: { name: athleteName } })
    athleteId = u.user!.id
    await admin().from('coach_athlete').insert({ coach_id: c.id, athlete_id: athleteId, relationship: 'head' })
  })

  it('search → start → inbox row → people → react', async () => {
    const people = await searchPeople(coach, athleteName)
    expect(people.map((p) => p.user_id)).toEqual([athleteId])
    expect(people[0].person_kind).toBe('athlete')
    const id = await startConversation(coach, [athleteId], null)
    const { data: me } = await coach.auth.getUser()
    const { data: msg } = await coach.from('messages').insert({ thread_id: id, from_user_id: me.user.id, kind: 'text', body: 'hi' }).select().single()
    const inbox = await fetchConversations(coach)
    const row = inbox.find((c) => c.thread_id === id)!
    expect(row.kind).toBe('chat')
    expect(row.members.map((m) => m.user_id)).toEqual([athleteId])
    expect((await fetchThreadPeople(coach, id)).map((p) => p.name)).toContain(athleteName)
    expect(await setReaction(coach, msg.id, 'like')).toBe('like')
    expect((await fetchReactions(coach, id)).map((r) => r.kind)).toEqual(['like'])
  })
})
