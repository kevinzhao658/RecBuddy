import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, createAndSignIn } from './helpers'

describe('message reactions', () => {
  let coach: any, athlete: any, other: any, stranger: any
  let threadId: string, msgId: string

  beforeAll(async () => {
    coach = await createAndSignIn({ role: 'coach', name: `RC ${randomUUID()}`, title: 'Head Coach' })
    athlete = await createAndSignIn({ role: 'athlete', name: 'React Athlete' })
    other = await createAndSignIn({ role: 'athlete', name: 'React Other' })
    stranger = await createAndSignIn({ role: 'athlete', name: 'React Stranger' })
    await admin().from('coach_athlete').insert([
      { coach_id: coach.id, athlete_id: athlete.id, relationship: 'head' },
      { coach_id: coach.id, athlete_id: other.id, relationship: 'head' },
    ])
    threadId = (await coach.client.rpc('start_conversation', { p_user_ids: [athlete.id, other.id], p_title: 'Reacts' })).data
    msgId = (await coach.client.from('messages')
      .insert({ thread_id: threadId, from_user_id: coach.id, kind: 'text', body: 'Great work today' }).select().single()).data.id
  })

  const mine = async (client: any, who: string) =>
    ((await client.from('message_reactions').select('kind').eq('message_id', msgId).eq('user_id', who)).data ?? []).map((r: any) => r.kind)

  it('one reaction per user: set, switch, and same kind removes', async () => {
    expect((await athlete.client.rpc('set_reaction', { p_message: msgId, p_kind: 'like' })).data).toBe('like')
    expect(await mine(athlete.client, athlete.id)).toEqual(['like'])
    expect((await athlete.client.rpc('set_reaction', { p_message: msgId, p_kind: 'congrats' })).data).toBe('congrats')
    expect(await mine(athlete.client, athlete.id)).toEqual(['congrats'])
    const off = await athlete.client.rpc('set_reaction', { p_message: msgId, p_kind: 'congrats' })
    expect(off.error).toBeNull()
    expect(off.data).toBeNull()
    expect(await mine(athlete.client, athlete.id)).toEqual([])
  })

  it('everyone in the conversation sees who reacted; thread_id is filled in', async () => {
    await other.client.rpc('set_reaction', { p_message: msgId, p_kind: 'laugh' })
    const { data } = await coach.client.from('message_reactions').select('user_id, kind, thread_id').eq('message_id', msgId)
    expect(data).toContainEqual({ user_id: other.id, kind: 'laugh', thread_id: threadId })
  })

  it('a non-member cannot react or read reactions', async () => {
    expect((await stranger.client.rpc('set_reaction', { p_message: msgId, p_kind: 'like' })).error).not.toBeNull()
    expect((await stranger.client.from('message_reactions').select('kind').eq('message_id', msgId)).data ?? []).toEqual([])
  })

  it('clients cannot write reactions directly', async () => {
    const ins = await athlete.client.from('message_reactions').insert({ message_id: msgId, user_id: athlete.id, thread_id: threadId, kind: 'like' })
    expect(ins.error).not.toBeNull()
  })

  it('a readonly member cannot react', async () => {
    await admin().from('thread_members').update({ status: 'readonly' }).eq('thread_id', threadId).eq('user_id', other.id)
    expect((await other.client.rpc('set_reaction', { p_message: msgId, p_kind: 'question' })).error).not.toBeNull()
    await admin().from('thread_members').update({ status: 'active' }).eq('thread_id', threadId).eq('user_id', other.id)
  })

  it('an invalid kind is rejected', async () => {
    expect((await athlete.client.rpc('set_reaction', { p_message: msgId, p_kind: 'heart' })).error?.message).toMatch(/invalid reaction/)
  })

  it('reactions from a blocked user are hidden from the blocker, and they cannot react to each other', async () => {
    await other.client.rpc('set_reaction', { p_message: msgId, p_kind: 'laugh' })
    await athlete.client.rpc('block_user', { p_user_id: other.id })
    const seen = (await athlete.client.from('message_reactions').select('user_id').eq('message_id', msgId)).data!.map((r: any) => r.user_id)
    expect(seen).not.toContain(other.id)
    const { data: m2 } = await athlete.client.from('messages')
      .insert({ thread_id: threadId, from_user_id: athlete.id, kind: 'text', body: 'mine' }).select().single()
    expect((await other.client.rpc('set_reaction', { p_message: m2.id, p_kind: 'like' })).error).not.toBeNull()
  })

  it('deleting a message removes its reactions', async () => {
    const { data: m } = await coach.client.from('messages')
      .insert({ thread_id: threadId, from_user_id: coach.id, kind: 'text', body: 'temp' }).select().single()
    await coach.client.rpc('set_reaction', { p_message: m.id, p_kind: 'like' })
    await admin().from('messages').delete().eq('id', m.id)
    const { data } = await admin().from('message_reactions').select('kind').eq('message_id', m.id)
    expect(data).toEqual([])
  })
})
