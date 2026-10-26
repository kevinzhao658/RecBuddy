import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, createAndSignIn, addCoCoach, resetRateLimits } from './helpers'

type U = { id: string; client: any }

/** Service-role setup: a chat thread with the given members, all active. */
async function makeChat(members: U[]) {
  const sql = admin()
  const { data: t, error } = await sql.from('message_threads').insert({ kind: 'chat' }).select().single()
  if (error) throw error
  const { error: mErr } = await sql.from('thread_members')
    .insert(members.map((m) => ({ thread_id: t.id, user_id: m.id, status: 'active' })))
  if (mErr) throw mErr
  return t.id as string
}

const status = async (threadId: string, userId: string) =>
  (await admin().from('thread_members').select('status').eq('thread_id', threadId).eq('user_id', userId).single()).data?.status
const readOnly = async (threadId: string) =>
  (await admin().from('message_threads').select('read_only').eq('id', threadId).single()).data?.read_only
const team = async (athlete: U) =>
  ((await athlete.client.rpc('get_team', { p_athlete_id: athlete.id })).data ?? []) as { coach_id: string; relationship: string; permission: string }[]

// Unblocking puts back everything the block took away.
describe('unblock restores the connection', () => {
  let head: U, assistant: U, athlete: U, mate: U
  let dmAssistant: string, group: string, dmMate: string

  beforeAll(async () => {
    await resetRateLimits()
    head = await createAndSignIn({ role: 'coach', name: `UHead ${randomUUID()}`, title: 'Head Coach' })
    assistant = await createAndSignIn({ role: 'coach', name: `UAsst ${randomUUID()}`, title: 'Assistant Coach' })
    athlete = await createAndSignIn({ role: 'athlete', name: `UAth ${randomUUID()}` })
    mate = await createAndSignIn({ role: 'athlete', name: `UMate ${randomUUID()}` })
    const { data: code } = await (head.client as any).rpc('create_invite', { p_athlete_name: 'x' })
    expect((await athlete.client.rpc('redeem_invite', { p_code: code })).error).toBeNull()
    await addCoCoach(head.client, athlete.id, assistant)
    await head.client.rpc('set_coach_permission', { p_coach_id: assistant.id, p_athlete_id: athlete.id, p_permission: 'edit' })
    dmAssistant = await makeChat([athlete, assistant])
    group = await makeChat([athlete, assistant, mate])
    dmMate = await makeChat([athlete, mate])
  })

  it('a blocked coach comes back with the same role, permission, and chats', async () => {
    const before = (await team(athlete)).find((m) => m.coach_id === assistant.id)!
    expect((await athlete.client.rpc('block_user', { p_user_id: assistant.id })).error).toBeNull()
    expect((await team(athlete)).some((m) => m.coach_id === assistant.id)).toBe(false)
    expect(await status(group, assistant.id)).toBe('removed')

    expect((await athlete.client.rpc('unblock_user', { p_user_id: assistant.id })).error).toBeNull()
    expect((await athlete.client.rpc('get_blocked_users')).data).toEqual([])
    const after = (await team(athlete)).find((m) => m.coach_id === assistant.id)
    expect(after).toMatchObject({ relationship: before.relationship, permission: before.permission })
    expect(await readOnly(dmAssistant)).toBe(false)
    expect(await status(dmAssistant, assistant.id)).toBe('active')
    expect(await status(dmAssistant, athlete.id)).toBe('active')
    expect(await status(group, assistant.id)).toBe('active')
    const sent = await assistant.client.from('messages')
      .insert({ thread_id: dmAssistant, from_user_id: assistant.id, kind: 'text', body: 'back on the team' })
    expect(sent.error).toBeNull()
  })

  it('a head coach returns as an assistant if the athlete has a new head coach', async () => {
    expect((await athlete.client.rpc('block_user', { p_user_id: head.id })).error).toBeNull()
    const newHead = await createAndSignIn({ role: 'coach', name: `UNew ${randomUUID()}`, title: 'Head Coach' })
    const { data: code } = await (newHead.client as any).rpc('create_invite', { p_athlete_name: 'y' })
    expect((await athlete.client.rpc('redeem_invite', { p_code: code })).error).toBeNull()

    expect((await athlete.client.rpc('unblock_user', { p_user_id: head.id })).error).toBeNull()
    const rows = await team(athlete)
    expect(rows.find((m) => m.coach_id === head.id)?.relationship).toBe('assistant')
    expect(rows.filter((m) => m.relationship === 'head').map((m) => m.coach_id)).toEqual([newHead.id])
  })

  it('unblocking another athlete reopens your 1:1', async () => {
    expect((await athlete.client.rpc('block_user', { p_user_id: mate.id })).error).toBeNull()
    expect(await readOnly(dmMate)).toBe(true)
    expect((await athlete.client.rpc('unblock_user', { p_user_id: mate.id })).error).toBeNull()
    expect(await readOnly(dmMate)).toBe(false)
    expect(await status(dmMate, mate.id)).toBe('active')
  })

  it('unblocking someone who is not blocked changes nothing', async () => {
    const before = await team(athlete)
    expect((await athlete.client.rpc('unblock_user', { p_user_id: mate.id })).error).toBeNull()
    expect(await team(athlete)).toEqual(before)
  })
})
