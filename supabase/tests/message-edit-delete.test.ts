import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, createAndSignIn } from './helpers'
import { purgeExpiredVideos } from '../functions/purge-chat-videos/purge.ts'

type U = { id: string; email: string; client: any }

/** Service-role setup: a chat thread with the given members. */
async function makeChat(members: { id: string }[]) {
  const sql = admin()
  const { data: t, error } = await sql.from('message_threads').insert({ kind: 'chat' }).select().single()
  if (error) throw error
  for (const m of members) {
    const { error: mErr } = await sql.from('thread_members').insert({ thread_id: t.id, user_id: m.id, status: 'active' })
    if (mErr) throw mErr
  }
  return t.id as string
}

async function say(u: U, threadId: string, body: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await u.client.from('messages')
    .insert({ thread_id: threadId, from_user_id: u.id, kind: 'text', body, ...extra }).select('id').single()
  if (error) throw error
  return data.id as string
}

async function photo(u: U, threadId: string) {
  const path = `${threadId}/${randomUUID()}.jpg`
  await u.client.storage.from('chat-images').upload(path, Buffer.from('jpg'), { contentType: 'image/jpeg' })
  const { data, error } = await u.client.from('messages')
    .insert({ thread_id: threadId, from_user_id: u.id, kind: 'image', body: null, payload: { path, w: 600, h: 800 } }).select('id').single()
  if (error) throw error
  return { id: data.id as string, path }
}

const files = async (bucket: string, threadId: string) =>
  ((await admin().storage.from(bucket).list(threadId)).data ?? []).map((o: { name: string }) => `${threadId}/${o.name}`)

describe('editing your own messages', () => {
  let a: U, b: U, t: string
  beforeAll(async () => {
    a = await createAndSignIn({ role: 'athlete', name: `Edit A ${randomUUID()}` })
    b = await createAndSignIn({ role: 'athlete', name: `Edit B ${randomUUID()}` })
    t = await makeChat([{ id: a.id }, { id: b.id }])
  })

  it('the sender can change the text; everyone sees it, marked edited', async () => {
    const id = await say(a, t, 'tempo at 6')
    const { error } = await a.client.rpc('edit_message', { p_message: id, p_body: 'tempo at 6:30' })
    expect(error).toBeNull()
    const { data } = await b.client.from('messages').select('body, edited_at').eq('id', id).single()
    expect(data.body).toBe('tempo at 6:30')
    expect(data.edited_at).not.toBeNull()
  })

  it("nobody else can edit it, and a direct update is still refused", async () => {
    const id = await say(a, t, 'mine')
    expect((await b.client.rpc('edit_message', { p_message: id, p_body: 'hijacked' })).error).not.toBeNull()
    await a.client.from('messages').update({ body: 'sneaky' }).eq('id', id)
    const { data } = await b.client.from('messages').select('body').eq('id', id).single()
    expect(data.body).toBe('mine')
  })

  it('a text message cannot be emptied, and blocked words are refused like on send', async () => {
    const id = await say(a, t, 'ok')
    expect((await a.client.rpc('edit_message', { p_message: id, p_body: '   ' })).error).not.toBeNull()
    const { data: term } = await admin().from('blocked_terms').select('term').limit(1).maybeSingle()
    if (term) expect((await a.client.rpc('edit_message', { p_message: id, p_body: `you ${term.term}` })).error).not.toBeNull()
  })

  it('a photo caption can be added, changed, or cleared', async () => {
    const p = await photo(a, t)
    expect((await a.client.rpc('edit_message', { p_message: p.id, p_body: 'form check' })).error).toBeNull()
    expect((await a.client.rpc('edit_message', { p_message: p.id, p_body: '' })).error).toBeNull()
    const { data } = await b.client.from('messages').select('body').eq('id', p.id).single()
    expect(data.body).toBeNull()
  })

  it('logged-run and workout cards are not editable', async () => {
    const { data } = await admin().from('messages').insert({ thread_id: t, from_user_id: a.id, kind: 'runcard',
      payload: { title: 'Run', dist: '3 mi', pace: '9:00/mi', time: '27:00' } }).select('id').single()
    expect((await a.client.rpc('edit_message', { p_message: data!.id, p_body: 'x' })).error).not.toBeNull()
  })
})

describe('deleting your own messages', () => {
  let a: U, b: U, t: string
  beforeAll(async () => {
    a = await createAndSignIn({ role: 'athlete', name: `Del A ${randomUUID()}` })
    b = await createAndSignIn({ role: 'athlete', name: `Del B ${randomUUID()}` })
    t = await makeChat([{ id: a.id }, { id: b.id }])
  })

  it('the sender deletes it and it is gone for everyone, with its reactions; replies lose the quote', async () => {
    const id = await say(a, t, 'oops wrong chat')
    await b.client.from('message_reactions').insert({ message_id: id, user_id: b.id, kind: 'like' })
    const reply = await say(b, t, 'what?', { reply_to_id: id })
    expect((await a.client.rpc('delete_message', { p_message: id })).error).toBeNull()
    expect((await b.client.from('messages').select('id').eq('id', id)).data).toEqual([])
    expect((await admin().from('message_reactions').select('message_id').eq('message_id', id)).data).toEqual([])
    const { data } = await b.client.from('messages').select('reply_to_id').eq('id', reply).single()
    expect(data.reply_to_id).toBeNull()
  })

  it("nobody else can delete it", async () => {
    const id = await say(a, t, 'stays')
    expect((await b.client.rpc('delete_message', { p_message: id })).error).not.toBeNull()
    await b.client.from('messages').delete().eq('id', id)
    expect((await a.client.from('messages').select('id').eq('id', id)).data).toHaveLength(1)
  })

  it("a deleted photo's file is cleaned up; an open report keeps it until resolved", async () => {
    const sql = admin()
    const gone = await photo(a, t)
    const held = await photo(a, t)
    const { data: r } = await sql.from('content_reports').insert({ reporter_id: b.id, message_id: held.id, reason: 'spam',
      content_snapshot: { kind: 'image', body: null, payload: { path: held.path } } }).select('id').single()
    await a.client.rpc('delete_message', { p_message: gone.id })
    await a.client.rpc('delete_message', { p_message: held.id })
    await purgeExpiredVideos(sql, 500, '0 seconds')
    expect(await files('chat-images', t)).not.toContain(gone.path)
    expect(await files('chat-images', t)).toContain(held.path)
    await sql.from('content_reports').update({ status: 'dismissed' }).eq('id', r!.id)
    await purgeExpiredVideos(sql, 500, '0 seconds')
    expect(await files('chat-images', t)).not.toContain(held.path)
  })

  it("a deleted video's clip and preview are cleaned up", async () => {
    const sql = admin()
    const p = { path: `${t}/${randomUUID()}.mp4`, poster: `${t}/${randomUUID()}.jpg`, w: 720, h: 1280, duration_s: 5 }
    await a.client.storage.from('chat-videos').upload(p.path, Buffer.from('mp4'), { contentType: 'video/mp4' })
    await a.client.storage.from('chat-images').upload(p.poster, Buffer.from('jpg'), { contentType: 'image/jpeg' })
    const { data: m } = await a.client.from('messages').insert({ thread_id: t, from_user_id: a.id, kind: 'video', payload: p }).select('id').single()
    await a.client.rpc('delete_message', { p_message: m.id })
    await purgeExpiredVideos(sql, 500, '0 seconds')
    expect(await files('chat-videos', t)).not.toContain(p.path)
    expect(await files('chat-images', t)).not.toContain(p.poster)
  })

  it('clients cannot list orphaned photos', async () => {
    expect((await a.client.rpc('orphan_chat_images', { p_older_than: '0 seconds', p_limit: 5 })).error).not.toBeNull()
  })
})
