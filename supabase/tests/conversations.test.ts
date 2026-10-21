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

  it('nobody can create a team thread naming a coach who is not linked to the athlete', async () => {
    const outsider = await createAndSignIn({ role: 'coach', name: `Outsider ${randomUUID()}`, title: 'Head Coach' })
    const fresh = await createAndSignIn({ role: 'athlete', name: 'Fresh Two' })
    await link(coach.id, fresh.id)
    // a stranger coach squatting the athlete's single team slot
    const squat = await outsider.client.from('message_threads').insert({ athlete_id: fresh.id, coach_id: outsider.id })
    expect(squat.error).not.toBeNull()
    // the athlete attaching an unlinked coach
    const attach = await fresh.client.from('message_threads').insert({ athlete_id: fresh.id, coach_id: outsider.id })
    expect(attach.error).not.toBeNull()
  })

  it('clients cannot rewrite a team thread', async () => {
    const upd = await athlete.client.from('message_threads').update({ coach_id: stranger.id }).eq('id', teamId).select()
    expect(upd.data ?? []).toEqual([])
    const { data } = await admin().from('message_threads').select('coach_id').eq('id', teamId).single()
    expect(data!.coach_id).toBe(coach.id)
  })

  it('a member who joined later cannot load photos sent before they joined', async () => {
    const early = '2025-12-01T00:00:00Z'
    const id = await makeChat([{ id: athlete.id, joined_at: early }, { id: coach.id, joined_at: early }])
    const path = `${id}/${randomUUID()}.jpg`
    const up = await admin().storage.from('chat-images').upload(path, Buffer.from('jpg'), { contentType: 'image/jpeg' })
    expect(up.error).toBeNull()
    await admin().from('messages').insert({ thread_id: id, from_user_id: coach.id, kind: 'image', payload: { path, w: 1, h: 1 }, created_at: '2026-01-01T00:00:00Z' })
    await admin().from('thread_members').insert({ thread_id: id, user_id: other.id, status: 'active' })
    expect((await athlete.client.storage.from('chat-images').createSignedUrl(path, 60)).error).toBeNull()
    expect((await other.client.storage.from('chat-images').createSignedUrl(path, 60)).error).not.toBeNull()
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

// ── Task 2: search, start, membership, inbox ─────────────────────────────
describe('conversation RPCs', () => {
  // coachA heads athA + athB; coachB assists athA (shares athA with coachA);
  // coachC and athD are unrelated; athNone has no coach.
  let coachA: U, coachB: U, coachC: U, athA: U, athB: U, athD: U, athNone: U
  const tag = randomUUID().slice(0, 6)

  beforeAll(async () => {
    coachA = await createAndSignIn({ role: 'coach', name: `Dana ${tag}`, title: 'Head Coach' })
    coachB = await createAndSignIn({ role: 'coach', name: `Marco ${tag}`, title: 'Assistant Coach' })
    coachC = await createAndSignIn({ role: 'coach', name: `Cleo ${tag}`, title: 'Head Coach' })
    athA = await createAndSignIn({ role: 'athlete', name: `Maya ${tag}` })
    athB = await createAndSignIn({ role: 'athlete', name: `Bea ${tag}` })
    athD = await createAndSignIn({ role: 'athlete', name: `Dot ${tag}` })
    athNone = await createAndSignIn({ role: 'athlete', name: `None ${tag}` })
    await link(coachA.id, athA.id)
    await link(coachA.id, athB.id)
    await link(coachB.id, athA.id, 'assistant')
    await link(coachC.id, athD.id)
  })

  const ids = (rows: any[] | null) => (rows ?? []).map((r) => r.user_id)

  it('coach search finds their athletes and co-coaches, with context, and nobody else', async () => {
    const { data, error } = await coachA.client.rpc('search_chat_people', { p_query: tag })
    expect(error).toBeNull()
    expect(ids(data).sort()).toEqual([athA.id, athB.id, coachB.id].sort())
    const marco = data.find((r: any) => r.user_id === coachB.id)
    expect(marco.person_kind).toBe('coach')
    expect(marco.context).toBe(`Coaches Maya with you`)
    expect(data.find((r: any) => r.user_id === athA.id).context).toBe('Your athlete')
    expect(data[0].person_kind).toBe('coach') // coaches first
  })

  it('athlete search finds their coaches and athletes who share a coach', async () => {
    const { data } = await athA.client.rpc('search_chat_people', { p_query: tag })
    expect(ids(data).sort()).toEqual([coachA.id, coachB.id, athB.id].sort())
    expect(data.find((r: any) => r.user_id === coachA.id).context).toBe('Your coach')
    expect(data.find((r: any) => r.user_id === athB.id).context).toBe('Shares Dana with you')
  })

  it('search matches names case-insensitively', async () => {
    const { data } = await athA.client.rpc('search_chat_people', { p_query: 'bEa ' + tag })
    expect(ids(data)).toEqual([athB.id])
  })

  it('search excludes blocked users in both directions, and start refuses them', async () => {
    const x = await createAndSignIn({ role: 'athlete', name: `Xan ${tag}` })
    await link(coachA.id, x.id)
    await x.client.rpc('block_user', { p_user_id: athB.id })
    expect(ids((await athB.client.rpc('search_chat_people', { p_query: tag })).data)).not.toContain(x.id)
    expect(ids((await x.client.rpc('search_chat_people', { p_query: tag })).data)).not.toContain(athB.id)
    const r = await athB.client.rpc('start_conversation', { p_user_ids: [x.id] })
    expect(r.error?.message).toMatch(/can't add/)
  })

  it('an athlete with discoverability off is hidden from athletes but addable by their coach', async () => {
    const shy = await createAndSignIn({ role: 'athlete', name: `Shy ${tag}` })
    await link(coachA.id, shy.id)
    const grp = await coachA.client.rpc('start_conversation', { p_user_ids: [shy.id, athA.id], p_title: 'Crew' })
    expect(grp.error).toBeNull()
    await admin().from('profiles').update({ discoverable_to_athletes: false }).eq('id', shy.id)
    expect(ids((await athA.client.rpc('search_chat_people', { p_query: tag })).data)).not.toContain(shy.id)
    expect(ids((await coachA.client.rpc('search_chat_people', { p_query: tag })).data)).toContain(shy.id)
    expect((await athA.client.rpc('start_conversation', { p_user_ids: [shy.id] })).error?.message).toMatch(/can't add/)
    // already in the group: stays a member
    const { data: mem } = await shy.client.from('thread_members').select('status').eq('thread_id', grp.data).eq('user_id', shy.id).single()
    expect(mem!.status).toBe('active')
  })

  it('start_conversation reuses an identical member set and unhides a hidden 1:1', async () => {
    const a = await athA.client.rpc('start_conversation', { p_user_ids: [coachB.id] })
    expect(a.error).toBeNull()
    await athA.client.rpc('hide_conversation', { p_thread: a.data })
    let inbox = (await athA.client.rpc('my_conversations')).data as any[]
    expect(inbox.map((c) => c.thread_id)).not.toContain(a.data)
    const b = await athA.client.rpc('start_conversation', { p_user_ids: [coachB.id] })
    expect(b.data).toBe(a.data)
    inbox = (await athA.client.rpc('my_conversations')).data as any[]
    expect(inbox.map((c) => c.thread_id)).toContain(a.data)
  })

  it('rejects a group over 25 people and a filtered name', async () => {
    const many = Array.from({ length: 25 }, () => randomUUID())
    expect((await coachA.client.rpc('start_conversation', { p_user_ids: many })).error?.message).toMatch(/limited to 25/)
    expect((await coachA.client.rpc('start_conversation', { p_user_ids: [athA.id, athB.id], p_title: 'kys club' })).error?.message)
      .toMatch(/language/)
  })

  it('rename works for members and not for outsiders', async () => {
    const g = (await coachA.client.rpc('start_conversation', { p_user_ids: [athA.id, athB.id], p_title: 'Track night' })).data
    expect((await athB.client.rpc('rename_conversation', { p_thread: g, p_title: 'Tuesday track' })).error).toBeNull()
    expect((await coachC.client.rpc('rename_conversation', { p_thread: g, p_title: 'mine' })).error).not.toBeNull()
    const { data } = await athA.client.from('message_threads').select('title').eq('id', g).single()
    expect(data!.title).toBe('Tuesday track')
  })

  it('leave works for groups and errors for a 1:1', async () => {
    const g = (await coachA.client.rpc('start_conversation', { p_user_ids: [athA.id, athB.id], p_title: 'Leavers' })).data
    expect((await athB.client.rpc('leave_conversation', { p_thread: g })).error).toBeNull()
    expect((await athB.client.from('messages').select('id').eq('thread_id', g)).data ?? []).toEqual([])
    const one = (await athB.client.rpc('start_conversation', { p_user_ids: [coachA.id] })).data
    expect((await athB.client.rpc('leave_conversation', { p_thread: one })).error?.message).toMatch(/hide/)
  })

  it('an added member does not see messages from before they joined; adding to a 1:1 starts a new group', async () => {
    const g = (await coachA.client.rpc('start_conversation', { p_user_ids: [athA.id, athB.id], p_title: 'History' })).data
    await coachA.client.from('messages').insert({ thread_id: g, from_user_id: coachA.id, kind: 'text', body: 'early' })
    const add = await athA.client.rpc('add_conversation_members', { p_thread: g, p_user_ids: [coachB.id] })
    expect(add.error).toBeNull()
    expect(add.data).toBe(g)
    expect((await coachB.client.from('messages').select('id').eq('thread_id', g)).data ?? []).toEqual([])
    const one = (await athB.client.rpc('start_conversation', { p_user_ids: [coachA.id] })).data
    const grown = await athB.client.rpc('add_conversation_members', { p_thread: one, p_user_ids: [athA.id] })
    expect(grown.error).toBeNull()
    expect(grown.data).not.toBe(one)
  })

  it('my_conversations lists the athlete team chat first and counts unread per thread', async () => {
    await athA.client.rpc('team_thread_id', { p_athlete: athA.id })
    const g = (await coachA.client.rpc('start_conversation', { p_user_ids: [athA.id], p_title: null })).data
    // separate statements: rows inserted together share one now() timestamp
    await coachA.client.from('messages').insert({ thread_id: g, from_user_id: coachA.id, kind: 'text', body: 'one' })
    await coachA.client.from('messages').insert({ thread_id: g, from_user_id: coachA.id, kind: 'text', body: 'two' })
    let inbox = (await athA.client.rpc('my_conversations')).data as any[]
    expect(inbox[0].kind).toBe('team')
    const row = inbox.find((c) => c.thread_id === g)
    expect(row.unread).toBe(2)
    expect(row.last_body).toBe('two')
    expect(row.members.map((m: any) => m.user_id)).toEqual([coachA.id])
    await athA.client.rpc('mark_thread_read', { p_thread: g })
    inbox = (await athA.client.rpc('my_conversations')).data as any[]
    expect(inbox.find((c) => c.thread_id === g).unread).toBe(0)
  })

  it('a new message brings a hidden 1:1 back', async () => {
    const one = (await athA.client.rpc('start_conversation', { p_user_ids: [coachA.id] })).data
    await athA.client.rpc('hide_conversation', { p_thread: one })
    await coachA.client.from('messages').insert({ thread_id: one, from_user_id: coachA.id, kind: 'text', body: 'ping' })
    const inbox = (await athA.client.rpc('my_conversations')).data as any[]
    expect(inbox.map((c) => c.thread_id)).toContain(one)
  })

  it('my_conversations returns no team row for an athlete without a coach', async () => {
    const { data, error } = await athNone.client.rpc('my_conversations')
    expect(error).toBeNull()
    expect((data as any[]).filter((c) => c.kind === 'team')).toEqual([])
  })

  it('unread_message_counts counts team threads only, never chats', async () => {
    const before = (await coachB.client.rpc('unread_message_counts')).data as any[]
    const n0 = before.find((r) => r.athlete_id === athA.id)?.unread ?? 0
    const g = (await athA.client.rpc('start_conversation', { p_user_ids: [coachA.id, coachB.id], p_title: 'Both' })).data
    await athA.client.from('messages').insert({ thread_id: g, from_user_id: athA.id, kind: 'text', body: 'chat msg' })
    const after = (await coachB.client.rpc('unread_message_counts')).data as any[]
    expect(after.find((r) => r.athlete_id === athA.id)?.unread ?? 0).toBe(n0)
  })
})

// ── Task 3: membership follows coach removal and blocks ─────────────────
describe('conversation lifecycle', () => {
  const tag = randomUUID().slice(0, 6)
  const status = async (thread: string, user: string) =>
    (await admin().from('thread_members').select('status').eq('thread_id', thread).eq('user_id', user).single()).data!.status
  const readOnly = async (thread: string) =>
    (await admin().from('message_threads').select('read_only').eq('id', thread).single()).data!.read_only

  it('removing a coach makes their 1:1 with the athlete read-only for both', async () => {
    const c = await createAndSignIn({ role: 'coach', name: `Rem ${tag}`, title: 'Head Coach' })
    const a = await createAndSignIn({ role: 'athlete', name: `RemA ${tag}` })
    await link(c.id, a.id)
    const one = (await a.client.rpc('start_conversation', { p_user_ids: [c.id] })).data
    await a.client.from('coach_athlete').delete().eq('coach_id', c.id).eq('athlete_id', a.id)
    expect(await readOnly(one)).toBe(true)
    expect(await status(one, a.id)).toBe('readonly')
    expect(await status(one, c.id)).toBe('readonly')
    // both still read, neither posts
    expect((await c.client.from('message_threads').select('id').eq('id', one)).data).toHaveLength(1)
    expect((await a.client.from('messages').insert({ thread_id: one, from_user_id: a.id, kind: 'text', body: 'x' })).error).not.toBeNull()
  })

  it('removing a coach takes them out of groups with that athlete; the group continues', async () => {
    const c = await createAndSignIn({ role: 'coach', name: `Grp ${tag}`, title: 'Head Coach' })
    const c2 = await createAndSignIn({ role: 'coach', name: `Grp2 ${tag}`, title: 'Assistant Coach' })
    const a = await createAndSignIn({ role: 'athlete', name: `GrpA ${tag}` })
    await link(c.id, a.id)
    await link(c2.id, a.id, 'assistant')
    const g = (await c.client.rpc('start_conversation', { p_user_ids: [a.id, c2.id], p_title: 'Staff + Ada' })).data
    await a.client.from('coach_athlete').delete().eq('coach_id', c2.id).eq('athlete_id', a.id)
    expect(await status(g, c2.id)).toBe('removed')
    expect(await status(g, a.id)).toBe('active')
    expect(await readOnly(g)).toBe(false)
    expect((await c.client.from('messages').insert({ thread_id: g, from_user_id: c.id, kind: 'text', body: 'still here' })).error).toBeNull()
  })

  it('re-linking the coach reactivates the 1:1', async () => {
    const c = await createAndSignIn({ role: 'coach', name: `Back ${tag}`, title: 'Head Coach' })
    const a = await createAndSignIn({ role: 'athlete', name: `BackA ${tag}` })
    await link(c.id, a.id)
    const one = (await a.client.rpc('start_conversation', { p_user_ids: [c.id] })).data
    await admin().from('coach_athlete').delete().eq('coach_id', c.id).eq('athlete_id', a.id)
    await link(c.id, a.id)
    expect(await readOnly(one)).toBe(false)
    expect(await status(one, a.id)).toBe('active')
    expect(await status(one, c.id)).toBe('active')
  })

  it('blocking removes the blocked person from the 1:1 and leaves it read-only for the blocker', async () => {
    const c = await createAndSignIn({ role: 'coach', name: `Blk ${tag}`, title: 'Head Coach' })
    const a = await createAndSignIn({ role: 'athlete', name: `BlkA ${tag}` })
    await link(c.id, a.id)
    const one = (await a.client.rpc('start_conversation', { p_user_ids: [c.id] })).data
    await c.client.from('messages').insert({ thread_id: one, from_user_id: c.id, kind: 'text', body: 'before block' })
    expect((await a.client.rpc('block_user', { p_user_id: c.id })).error).toBeNull()
    expect(await status(one, c.id)).toBe('removed')
    expect(await readOnly(one)).toBe(true)
    expect((await c.client.from('message_threads').select('id').eq('id', one)).data ?? []).toEqual([])
    expect((await a.client.from('message_threads').select('id').eq('id', one)).data).toHaveLength(1)
  })

  it('in a shared group the blocker no longer sees the blocked person\'s messages', async () => {
    const c = await createAndSignIn({ role: 'coach', name: `Shr ${tag}`, title: 'Head Coach' })
    const a1 = await createAndSignIn({ role: 'athlete', name: `ShrA ${tag}` })
    const a2 = await createAndSignIn({ role: 'athlete', name: `ShrB ${tag}` })
    await link(c.id, a1.id)
    await link(c.id, a2.id)
    const g = (await c.client.rpc('start_conversation', { p_user_ids: [a1.id, a2.id], p_title: 'Shared' })).data
    await a2.client.from('messages').insert({ thread_id: g, from_user_id: a2.id, kind: 'text', body: 'from a2' })
    await a1.client.rpc('block_user', { p_user_id: a2.id })
    const seen = (await a1.client.from('messages').select('body').eq('thread_id', g)).data!.map((m: any) => m.body)
    expect(seen).not.toContain('from a2')
    expect(await status(g, a2.id)).toBe('active')
  })
})

// ── Security review fixes ────────────────────────────────────────────────
describe('reach trust boundary', () => {
  const tag = randomUUID().slice(0, 6)

  it('an athlete cannot link themselves to an arbitrary coach (no reach without an invite)', async () => {
    const c = await createAndSignIn({ role: 'coach', name: `Far ${tag}`, title: 'Head Coach' })
    const roster = await createAndSignIn({ role: 'athlete', name: `Roster ${tag}` })
    await link(c.id, roster.id)
    const a = await createAndSignIn({ role: 'athlete', name: `Pushy ${tag}` })
    const ins = await a.client.from('coach_athlete').insert({ coach_id: c.id, athlete_id: a.id, relationship: 'head' })
    expect(ins.error).not.toBeNull()
    const found = ((await a.client.rpc('search_chat_people', { p_query: tag })).data ?? []).map((r: any) => r.user_id)
    expect(found).not.toContain(roster.id)
    expect(found).not.toContain(c.id)
  })

  it('athletes can still remove their own coach, and an admin coach can still add a co-coach', async () => {
    const head = await createAndSignIn({ role: 'coach', name: `Hd ${tag}`, title: 'Head Coach' })
    const asst = await createAndSignIn({ role: 'coach', name: `As ${tag}`, title: 'Assistant Coach' })
    const a = await createAndSignIn({ role: 'athlete', name: `Own ${tag}` })
    await admin().from('coach_athlete').insert({ coach_id: head.id, athlete_id: a.id, relationship: 'head', permission: 'admin' })
    const add = await head.client.from('coach_athlete').insert({ coach_id: asst.id, athlete_id: a.id, relationship: 'assistant' })
    expect(add.error).toBeNull()
    const del = await a.client.from('coach_athlete').delete().eq('coach_id', asst.id).eq('athlete_id', a.id).select()
    expect(del.data).toHaveLength(1)
  })

  it('an athlete cannot repoint an existing coaching link to another coach', async () => {
    const c = await createAndSignIn({ role: 'coach', name: `Mine ${tag}`, title: 'Head Coach' })
    const other = await createAndSignIn({ role: 'coach', name: `Theirs ${tag}`, title: 'Head Coach' })
    const a = await createAndSignIn({ role: 'athlete', name: `Repoint ${tag}` })
    await link(c.id, a.id)
    const upd = await a.client.from('coach_athlete').update({ coach_id: other.id }).eq('coach_id', c.id).eq('athlete_id', a.id)
    expect(upd.error).not.toBeNull()
    const { data } = await admin().from('coach_athlete').select('coach_id').eq('athlete_id', a.id)
    expect(data!.map((r: any) => r.coach_id)).toEqual([c.id])
  })

  it('the "can\'t add" error does not reveal the target\'s name', async () => {
    const hidden = await createAndSignIn({ role: 'athlete', name: `Secret Name ${tag}` })
    const a = await createAndSignIn({ role: 'athlete', name: `Asker ${tag}` })
    const r = await a.client.rpc('start_conversation', { p_user_ids: [hidden.id] })
    expect(r.error?.message).toMatch(/can't add/)
    expect(r.error?.message).not.toMatch(/Secret Name/)
  })

  it('a client-created team thread cannot carry a title, creator, or read-only flag', async () => {
    const c = await createAndSignIn({ role: 'coach', name: `Tt ${tag}`, title: 'Head Coach' })
    const a = await createAndSignIn({ role: 'athlete', name: `TtA ${tag}` })
    await link(c.id, a.id)
    const bad = await a.client.from('message_threads')
      .insert({ athlete_id: a.id, coach_id: c.id, title: 'pwned', read_only: true, created_by: c.id })
    expect(bad.error).not.toBeNull()
  })
})

describe('lifecycle edge cases (security review)', () => {
  const tag = randomUUID().slice(0, 6)
  const ro = async (t: string) => (await admin().from('message_threads').select('read_only').eq('id', t).single()).data!.read_only

  it('a self-coaching link neither reopens nor closes other 1:1s', async () => {
    const x = await createAndSignIn({ role: 'coach', name: `Self ${tag}`, title: 'Head Coach' })
    const a = await createAndSignIn({ role: 'athlete', name: `SelfA ${tag}` })
    const b = await createAndSignIn({ role: 'athlete', name: `SelfB ${tag}` })
    await link(x.id, a.id)
    await link(x.id, b.id)
    const withA = (await a.client.rpc('start_conversation', { p_user_ids: [x.id] })).data
    const withB = (await b.client.rpc('start_conversation', { p_user_ids: [x.id] })).data
    await a.client.from('coach_athlete').delete().eq('coach_id', x.id).eq('athlete_id', a.id)
    expect(await ro(withA)).toBe(true)
    await admin().from('coach_athlete').insert({ coach_id: x.id, athlete_id: x.id, relationship: 'head' })
    expect(await ro(withA)).toBe(true)          // self-link must not reopen
    await admin().from('coach_athlete').delete().eq('coach_id', x.id).eq('athlete_id', x.id)
    expect(await ro(withB)).toBe(false)         // self-unlink must not close
  })

  it('a member removed from a group cannot be added back', async () => {
    const c1 = await createAndSignIn({ role: 'coach', name: `Ra ${tag}`, title: 'Head Coach' })
    const c2 = await createAndSignIn({ role: 'coach', name: `Rb ${tag}`, title: 'Assistant Coach' })
    const a = await createAndSignIn({ role: 'athlete', name: `RaA ${tag}` })
    const b = await createAndSignIn({ role: 'athlete', name: `RaB ${tag}` })
    await link(c1.id, a.id)
    await link(c2.id, a.id, 'assistant')
    await link(c1.id, b.id)
    await link(c2.id, b.id, 'assistant') // c1 and c2 still share b after c2 leaves a's team
    const g = (await c1.client.rpc('start_conversation', { p_user_ids: [a.id, c2.id], p_title: 'Grp' })).data
    await a.client.from('coach_athlete').delete().eq('coach_id', c2.id).eq('athlete_id', a.id)
    const re = await c1.client.rpc('add_conversation_members', { p_thread: g, p_user_ids: [c2.id] })
    expect(re.error?.message).toMatch(/can't add/)
  })
})

describe('thread_people', () => {
  const tag = randomUUID().slice(0, 6)
  it('returns names for everyone who can appear in a thread the caller can read, and nothing otherwise', async () => {
    const c = await createAndSignIn({ role: 'coach', name: `Pc ${tag}`, title: 'Head Coach' })
    const a = await createAndSignIn({ role: 'athlete', name: `Pa ${tag}` })
    const b = await createAndSignIn({ role: 'athlete', name: `Pb ${tag}` })
    const s = await createAndSignIn({ role: 'athlete', name: `Ps ${tag}` })
    await link(c.id, a.id)
    await link(c.id, b.id)
    const g = (await c.client.rpc('start_conversation', { p_user_ids: [a.id, b.id], p_title: 'People' })).data
    await b.client.rpc('leave_conversation', { p_thread: g })
    const { data, error } = await a.client.rpc('thread_people', { p_thread: g })
    expect(error).toBeNull()
    expect((data as any[]).map((p) => p.user_id).sort()).toEqual([a.id, b.id, c.id].sort()) // left members keep their name on old messages
    expect((await s.client.rpc('thread_people', { p_thread: g })).data ?? []).toEqual([])
    const team = await a.client.rpc('team_thread_id', { p_athlete: a.id })
    const tp = (await a.client.rpc('thread_people', { p_thread: team.data })).data as any[]
    expect(tp.map((p) => p.user_id).sort()).toEqual([a.id, c.id].sort())
  })

})
