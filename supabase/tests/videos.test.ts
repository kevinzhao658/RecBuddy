import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, createAndSignIn } from './helpers'

type U = { id: string; email: string; client: any }

/** Service-role setup: a chat thread with the given members. */
async function makeChat(members: { id: string; joined_at?: string }[]) {
  const sql = admin()
  const { data: t, error } = await sql.from('message_threads').insert({ kind: 'chat' }).select().single()
  if (error) throw error
  // One row at a time: a bulk insert would null joined_at on rows that omit it.
  for (const m of members) {
    const { error: mErr } = await sql.from('thread_members')
      .insert({ thread_id: t.id, user_id: m.id, status: 'active', ...(m.joined_at ? { joined_at: m.joined_at } : {}) })
    if (mErr) throw mErr
  }
  return t.id as string
}

const payload = (threadId: string, over: Record<string, unknown> = {}) => ({
  path: `${threadId}/${randomUUID()}.mp4`, poster: `${threadId}/${randomUUID()}.jpg`, w: 720, h: 1280, duration_s: 12, ...over,
})

describe('video messages', () => {
  let a: U, b: U, threadId: string

  beforeAll(async () => {
    a = await createAndSignIn({ role: 'athlete', name: `Vid A ${randomUUID()}` })
    b = await createAndSignIn({ role: 'athlete', name: `Vid B ${randomUUID()}` })
    threadId = await makeChat([{ id: a.id }, { id: b.id }])
  })

  it('a member can post a video message row', async () => {
    const { error } = await a.client.from('messages')
      .insert({ thread_id: threadId, from_user_id: a.id, kind: 'video', body: null, payload: payload(threadId) })
    expect(error).toBeNull()
  })
  it('expires_at is set by the server', async () => {
    const { data, error } = await a.client.from('messages')
      .insert({ thread_id: threadId, from_user_id: a.id, kind: 'video', payload: payload(threadId), expires_at: '2099-01-01T00:00:00Z' })
      .select('created_at, expires_at').single()
    expect(error).toBeNull()
    const gap = new Date(data.expires_at).getTime() - new Date(data.created_at).getTime()
    expect(Math.abs(gap - 7 * 24 * 3600 * 1000)).toBeLessThan(5000)
  })

  it('refuses a 61-second clip', async () => {
    const { error } = await a.client.from('messages')
      .insert({ thread_id: threadId, from_user_id: a.id, kind: 'video', payload: payload(threadId, { duration_s: 61 }) })
    expect(error?.message).toMatch(/60 seconds/)
  })

  it('refuses a path or poster outside the thread folder', async () => {
    const elsewhere = randomUUID()
    const bad1 = await a.client.from('messages').insert({ thread_id: threadId, from_user_id: a.id, kind: 'video',
      payload: payload(threadId, { path: `${elsewhere}/x.mp4` }) })
    expect(bad1.error).not.toBeNull()
    const bad2 = await a.client.from('messages').insert({ thread_id: threadId, from_user_id: a.id, kind: 'video',
      payload: payload(threadId, { poster: `${threadId}/../${elsewhere}/x.jpg` }) })
    expect(bad2.error).not.toBeNull()
  })

  it('a client cannot clear its own expiry', async () => {
    const { data } = await a.client.from('messages')
      .insert({ thread_id: threadId, from_user_id: a.id, kind: 'video', payload: payload(threadId) }).select('id, expires_at').single()
    await a.client.from('messages').update({ expires_at: '2099-01-01T00:00:00Z', media_purged_at: null }).eq('id', data.id)
    const after = await admin().from('messages').select('expires_at').eq('id', data.id).single()
    expect(after.data!.expires_at).toBe(data.expires_at)
  })
})

describe('video read rules match photos', () => {
  it('members read the video and its poster; non-members, late joiners and blockers cannot', async () => {
    const tag = randomUUID()
    const sender = await createAndSignIn({ role: 'athlete', name: `Sender ${tag}` })
    const member = await createAndSignIn({ role: 'athlete', name: `Member ${tag}` })
    const outsider = await createAndSignIn({ role: 'athlete', name: `Outsider ${tag}` })
    const late = await createAndSignIn({ role: 'athlete', name: `Late ${tag}` })
    const blocker = await createAndSignIn({ role: 'athlete', name: `Blocker ${tag}` })
    const t = await makeChat([{ id: sender.id }, { id: member.id }, { id: blocker.id },
      { id: late.id, joined_at: new Date(Date.now() + 60_000).toISOString() }])
    const p = payload(t)
    expect((await sender.client.storage.from('chat-videos').upload(p.path, Buffer.from('mp4'), { contentType: 'video/mp4' })).error).toBeNull()
    expect((await sender.client.storage.from('chat-images').upload(p.poster, Buffer.from('jpg'), { contentType: 'image/jpeg' })).error).toBeNull()
    expect((await sender.client.from('messages').insert({ thread_id: t, from_user_id: sender.id, kind: 'video', payload: p })).error).toBeNull()
    await admin().from('user_blocks').insert({ blocker_id: blocker.id, blocked_id: sender.id })

    const canRead = async (u: U, bucket: string, path: string) =>
      (await u.client.storage.from(bucket).createSignedUrl(path, 60)).error === null
    expect(await canRead(member, 'chat-videos', p.path)).toBe(true)
    expect(await canRead(member, 'chat-images', p.poster)).toBe(true)
    expect(await canRead(outsider, 'chat-videos', p.path)).toBe(false)
    expect(await canRead(late, 'chat-videos', p.path)).toBe(false)
    expect(await canRead(blocker, 'chat-videos', p.path)).toBe(false)
  })

  it('a non-member cannot upload into a thread folder', async () => {
    const sender = await createAndSignIn({ role: 'athlete', name: `S ${randomUUID()}` })
    const outsider = await createAndSignIn({ role: 'athlete', name: `O ${randomUUID()}` })
    const t = await makeChat([{ id: sender.id }])
    const up = await outsider.client.storage.from('chat-videos').upload(`${t}/${randomUUID()}.mp4`, Buffer.from('mp4'), { contentType: 'video/mp4' })
    expect(up.error).not.toBeNull()
  })
})
