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
  const { error: mErr } = await sql.from('thread_members').insert(
    members.map((m) => ({ thread_id: t.id, user_id: m.id, status: 'active', ...(m.joined_at ? { joined_at: m.joined_at } : {}) })))
  if (mErr) throw mErr
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
})
