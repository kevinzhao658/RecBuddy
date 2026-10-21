import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, createAndSignIn } from './helpers'

type U = { id: string; email: string; client: any }

/** Service-role setup: a chat thread with the given members (all active unless overridden). */
async function makeChat(members: { id: string; status?: string; joined_at?: string }[], title: string | null = null) {
  const sql = admin()
  const { data: t, error } = await sql.from('message_threads').insert({ kind: 'chat', title }).select().single()
  if (error) throw error
  const { error: mErr } = await sql.from('thread_members').insert(
    members.map((m) => ({ thread_id: t.id, user_id: m.id, status: m.status ?? 'active', ...(m.joined_at ? { joined_at: m.joined_at } : {}) })))
  if (mErr) throw mErr
  return t.id as string
}

async function link(coach: string, athlete: string, relationship: 'head' | 'assistant' = 'head') {
  const { error } = await admin().from('coach_athlete').insert({ coach_id: coach, athlete_id: athlete, relationship })
  if (error) throw error
}

describe('conversation access', () => {
  let coach: U, athlete: U, stranger: U, other: U, loner: U
  let teamId: string

  beforeAll(async () => {
    coach = await createAndSignIn({ role: 'coach', name: `Coach ${randomUUID()}`, title: 'Head Coach' })
    athlete = await createAndSignIn({ role: 'athlete', name: 'Ada Athlete' })
    other = await createAndSignIn({ role: 'athlete', name: 'Otto Other' })
    stranger = await createAndSignIn({ role: 'athlete', name: 'Sam Stranger' })
    loner = await createAndSignIn({ role: 'athlete', name: 'Lou Loner' })
    await link(coach.id, athlete.id)
    await link(coach.id, other.id)
    const { data: t } = await admin().from('message_threads')
      .insert({ athlete_id: athlete.id, coach_id: coach.id }).select().single()
    teamId = t!.id
  })

  it('existing and new team threads default to kind=team and stay readable by athlete and coach, not strangers', async () => {
    const { data: row } = await admin().from('message_threads').select('kind').eq('id', teamId).single()
    expect(row!.kind).toBe('team')
    expect((await athlete.client.from('message_threads').select('id').eq('id', teamId)).data).toHaveLength(1)
    expect((await coach.client.from('message_threads').select('id').eq('id', teamId)).data).toHaveLength(1)
    expect((await stranger.client.from('message_threads').select('id').eq('id', teamId)).data ?? []).toEqual([])
  })

  it('a client can create a team thread and read it back in the same request', async () => {
    const a2 = await createAndSignIn({ role: 'athlete', name: 'Fresh Athlete' })
    await link(coach.id, a2.id)
    const { data, error } = await a2.client.from('message_threads')
      .insert({ athlete_id: a2.id, coach_id: coach.id }).select().single()
    expect(error).toBeNull()
    expect(data.kind).toBe('team')
  })

  it('chat thread is readable only by active/readonly members', async () => {
    const id = await makeChat([{ id: athlete.id }, { id: other.id }])
    const { error } = await athlete.client.from('messages').insert({ thread_id: id, from_user_id: athlete.id, kind: 'text', body: 'hi' })
    expect(error).toBeNull()
    expect((await other.client.from('messages').select('id').eq('thread_id', id)).data).toHaveLength(1)
    expect((await coach.client.from('messages').select('id').eq('thread_id', id)).data ?? []).toEqual([])
    expect((await coach.client.from('message_threads').select('id').eq('id', id)).data ?? []).toEqual([])
    const ins = await stranger.client.from('messages').insert({ thread_id: id, from_user_id: stranger.id, kind: 'text', body: 'x' })
    expect(ins.error).not.toBeNull()
  })

  it('members can see the member list; non-members cannot', async () => {
    const id = await makeChat([{ id: athlete.id }, { id: other.id }])
    expect((await athlete.client.from('thread_members').select('user_id').eq('thread_id', id)).data).toHaveLength(2)
    expect((await stranger.client.from('thread_members').select('user_id').eq('thread_id', id)).data ?? []).toEqual([])
  })

  it('a readonly member can read but not post, and left/removed members cannot read', async () => {
    const id = await makeChat([{ id: athlete.id, status: 'readonly' }, { id: other.id, status: 'left' }, { id: coach.id }])
    await coach.client.from('messages').insert({ thread_id: id, from_user_id: coach.id, kind: 'text', body: 'old news' })
    expect((await athlete.client.from('messages').select('id').eq('thread_id', id)).data).toHaveLength(1)
    const post = await athlete.client.from('messages').insert({ thread_id: id, from_user_id: athlete.id, kind: 'text', body: 'nope' })
    expect(post.error).not.toBeNull()
    expect((await other.client.from('messages').select('id').eq('thread_id', id)).data ?? []).toEqual([])
  })

  it('a read_only thread blocks posting even for active members', async () => {
    const id = await makeChat([{ id: athlete.id }, { id: coach.id }])
    await admin().from('message_threads').update({ read_only: true }).eq('id', id)
    const post = await coach.client.from('messages').insert({ thread_id: id, from_user_id: coach.id, kind: 'text', body: 'x' })
    expect(post.error).not.toBeNull()
  })

  it('a member only sees messages sent after they joined', async () => {
    const id = await makeChat([{ id: athlete.id }, { id: coach.id }])
    await admin().from('messages').insert({ thread_id: id, from_user_id: coach.id, kind: 'text', body: 'before', created_at: '2026-01-01T00:00:00Z' })
    await admin().from('thread_members').insert({ thread_id: id, user_id: other.id, status: 'active' })
    await coach.client.from('messages').insert({ thread_id: id, from_user_id: coach.id, kind: 'text', body: 'after' })
    const { data } = await other.client.from('messages').select('body').eq('thread_id', id)
    expect(data!.map((m: any) => m.body)).toEqual(['after'])
  })

  it('clients cannot create chat threads or members directly', async () => {
    const t = await athlete.client.from('message_threads').insert({ kind: 'chat' }).select()
    expect(t.error).not.toBeNull()
    const id = await makeChat([{ id: athlete.id }])
    const m = await athlete.client.from('thread_members').insert({ thread_id: id, user_id: stranger.id, status: 'active' })
    expect(m.error).not.toBeNull()
  })

  it('report_content works on a chat message for a member and not for a non-member', async () => {
    const id = await makeChat([{ id: athlete.id }, { id: other.id }])
    const { data: m } = await other.client.from('messages')
      .insert({ thread_id: id, from_user_id: other.id, kind: 'text', body: 'rude' }).select().single()
    const ok = await athlete.client.rpc('report_content', { p_reason: 'harassment', p_message_id: m.id })
    expect(ok.error).toBeNull()
    const no = await stranger.client.rpc('report_content', { p_reason: 'spam', p_message_id: m.id })
    expect(no.error?.message).toMatch(/message not found/)
  })

  it('a user can be reported directly by someone who shares a conversation with them', async () => {
    const id = await makeChat([{ id: athlete.id }, { id: stranger.id }])
    expect(id).toBeTruthy()
    const r = await athlete.client.rpc('report_content', { p_reason: 'spam', p_reported_user_id: stranger.id })
    expect(r.error).toBeNull()
  })

  it('team_thread_id returns one stable id and raises for an athlete with no coach', async () => {
    const a = await athlete.client.rpc('team_thread_id', { p_athlete: athlete.id })
    const b = await coach.client.rpc('team_thread_id', { p_athlete: athlete.id })
    expect(a.error).toBeNull()
    expect(a.data).toBe(teamId)
    expect(b.data).toBe(teamId)
    const none = await loner.client.rpc('team_thread_id', { p_athlete: loner.id })
    expect(none.error?.message).toMatch(/no coach linked yet/)
    const nosy = await stranger.client.rpc('team_thread_id', { p_athlete: athlete.id })
    expect(nosy.error).not.toBeNull()
  })
})
