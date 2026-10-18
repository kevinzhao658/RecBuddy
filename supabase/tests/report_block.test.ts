import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, createAndSignIn } from './helpers'

// App Store guideline 1.2: report, block, and the language filter.
describe('report + block + language filter', () => {
  let head: any, assistant: any, athlete: any, stranger: any
  let threadId: string
  let coachMsgId: string

  beforeAll(async () => {
    head = await createAndSignIn({ role: 'coach', name: `Head ${randomUUID()}`, title: 'Head Coach' })
    assistant = await createAndSignIn({ role: 'coach', name: `Asst ${randomUUID()}`, title: 'Assistant Coach' })
    athlete = await createAndSignIn({ role: 'athlete', name: 'Blocking Athlete' })
    stranger = await createAndSignIn({ role: 'athlete', name: 'Stranger' })

    const { data: code } = await head.client.rpc('create_invite', { p_athlete_name: 'x' })
    const { error: rErr } = await athlete.client.rpc('redeem_invite', { p_code: code })
    expect(rErr).toBeNull()
    await head.client.from('coach_athlete').insert({ coach_id: assistant.id, athlete_id: athlete.id, relationship: 'assistant' })

    const { data: t } = await athlete.client.from('message_threads')
      .insert({ athlete_id: athlete.id, coach_id: head.id }).select().single()
    threadId = t.id
    const { data: m, error } = await head.client.from('messages')
      .insert({ thread_id: threadId, from_user_id: head.id, kind: 'text', body: 'nice tempo today' })
      .select().single()
    expect(error).toBeNull()
    coachMsgId = m.id
  })

  // ── Filter ────────────────────────────────────────────────────────────
  it('rejects a message containing a blocked term, any case', async () => {
    const { error } = await head.client.from('messages')
      .insert({ thread_id: threadId, from_user_id: head.id, kind: 'text', body: 'just KYS already' })
    expect(error?.message).toMatch(/language that isn't allowed/)
  })

  it('allows ordinary profanity and words that merely contain a term', async () => {
    const { error } = await athlete.client.from('messages')
      .insert({ thread_id: threadId, from_user_id: athlete.id, kind: 'text', body: 'damn, that hill was hard. saw a raccoon too' })
    expect(error).toBeNull()
  })

  // ── Report ────────────────────────────────────────────────────────────
  it('athlete reports a coach message; snapshot is kept', async () => {
    const { data: id, error } = await athlete.client.rpc('report_content', {
      p_reason: 'harassment', p_message_id: coachMsgId, p_details: 'test',
    })
    expect(error).toBeNull()
    const { data: row } = await admin().from('content_reports').select('*').eq('id', id).single()
    expect(row.reporter_id).toBe(athlete.id)
    expect(row.reported_user_id).toBe(head.id)
    expect(row.content_snapshot.body).toBe('nice tempo today')
    expect(row.status).toBe('open')
  })

  it('reporter sees their own reports; others do not', async () => {
    const mine = await athlete.client.from('content_reports').select('id')
    expect(mine.data!.length).toBeGreaterThan(0)
    const theirs = await head.client.from('content_reports').select('id')
    expect(theirs.data ?? []).toEqual([])
  })

  it('a non-participant cannot report a message they cannot see', async () => {
    const { error } = await stranger.client.rpc('report_content', { p_reason: 'spam', p_message_id: coachMsgId })
    expect(error?.message).toMatch(/message not found/)
  })

  it('rejects an invalid reason and reporting yourself', async () => {
    const bad = await athlete.client.rpc('report_content', { p_reason: 'meh', p_message_id: coachMsgId })
    expect(bad.error?.message).toMatch(/invalid reason/)
    const self = await athlete.client.rpc('report_content', { p_reason: 'spam', p_reported_user_id: athlete.id })
    expect(self.error).not.toBeNull()
  })

  it('cannot report an unconnected user', async () => {
    const { error } = await athlete.client.rpc('report_content', { p_reason: 'spam', p_reported_user_id: stranger.id })
    expect(error?.message).toMatch(/user not found/)
  })

  it('cannot insert reports directly', async () => {
    const { error } = await athlete.client.from('content_reports')
      .insert({ reporter_id: athlete.id, reason: 'spam' })
    expect(error).not.toBeNull()
  })

  // ── Block ─────────────────────────────────────────────────────────────
  it('blocking the head coach severs the link and cuts their thread access', async () => {
    const { error } = await athlete.client.rpc('block_user', { p_user_id: head.id })
    expect(error).toBeNull()

    const { data: links } = await admin().from('coach_athlete').select('coach_id').eq('athlete_id', athlete.id)
    expect(links!.map((l: any) => l.coach_id)).toEqual([assistant.id])

    // Blocked coach: can't post, can't read the thread or its messages.
    const send = await head.client.from('messages')
      .insert({ thread_id: threadId, from_user_id: head.id, kind: 'text', body: 'hello?' })
    expect(send.error).not.toBeNull()
    const read = await head.client.from('messages').select('id').eq('thread_id', threadId)
    expect(read.data ?? []).toEqual([])
    const thread = await head.client.from('message_threads').select('id').eq('id', threadId)
    expect(thread.data ?? []).toEqual([])
  })

  it('athlete no longer sees the blocked coach messages; the assistant still can post', async () => {
    const { data } = await athlete.client.from('messages').select('id, from_user_id').eq('thread_id', threadId)
    expect(data!.some((m: any) => m.from_user_id === head.id)).toBe(false)
    const { error } = await assistant.client.from('messages')
      .insert({ thread_id: threadId, from_user_id: assistant.id, kind: 'text', body: 'still here' })
    expect(error).toBeNull()
  })

  it('a blocked coach cannot re-link by any path', async () => {
    const viaAdd = await head.client.rpc('coach_add_athlete', { p_athlete_id: athlete.id, p_relationship: 'assistant' })
    expect(viaAdd.error?.message).toMatch(/connection is blocked/)
    const { data: code } = await head.client.rpc('create_invite', { p_athlete_name: 'again' })
    const viaInvite = await athlete.client.rpc('redeem_invite', { p_code: code })
    expect(viaInvite.error?.message).toMatch(/connection is blocked/)
  })

  it('lists blocked users with names, and the block can still be reported', async () => {
    const { data } = await athlete.client.rpc('get_blocked_users')
    expect(data!.map((u: any) => u.user_id)).toEqual([head.id])
    expect(data![0].name).toMatch(/^Head /)
    const { error } = await athlete.client.rpc('report_content', { p_reason: 'other', p_reported_user_id: head.id })
    expect(error).toBeNull()
  })

  it('has_blocked does not leak other pairs', async () => {
    const { data } = await stranger.client.rpc('has_blocked', { _blocker: athlete.id, _blocked: head.id })
    expect(data).toBe(false)
  })

  it('nobody can block on someone else\'s behalf or block themselves', async () => {
    const forged = await stranger.client.from('user_blocks').insert({ blocker_id: athlete.id, blocked_id: assistant.id })
    expect(forged.error).not.toBeNull()
    const self = await athlete.client.rpc('block_user', { p_user_id: athlete.id })
    expect(self.error).not.toBeNull()
  })

  it('unblock removes the block; the coach can then re-link by invite', async () => {
    const del = await athlete.client.from('user_blocks').delete().eq('blocker_id', athlete.id).eq('blocked_id', head.id)
    expect(del.error).toBeNull()
    const { data } = await athlete.client.rpc('get_blocked_users')
    expect(data).toEqual([])
    const { data: code } = await head.client.rpc('create_invite', { p_athlete_name: 'back' })
    const redo = await athlete.client.rpc('redeem_invite', { p_code: code })
    expect(redo.error).toBeNull()
  })
})
