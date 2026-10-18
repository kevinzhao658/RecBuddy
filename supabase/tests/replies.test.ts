import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, createAndSignIn } from './helpers'

describe('message replies', () => {
  let coach: any, athlete: any, otherAthlete: any
  let threadId: string, otherThreadId: string, originalId: string

  beforeAll(async () => {
    coach = await createAndSignIn({ role: 'coach', name: `Coach ${randomUUID()}`, title: 'Head Coach' })
    athlete = await createAndSignIn({ role: 'athlete', name: 'Replying Athlete' })
    otherAthlete = await createAndSignIn({ role: 'athlete', name: 'Other Athlete' })
    const sql = admin()
    await sql.from('coach_athlete').insert([
      { coach_id: coach.id, athlete_id: athlete.id, relationship: 'head' },
      { coach_id: coach.id, athlete_id: otherAthlete.id, relationship: 'head' },
    ])
    const { data: t1 } = await sql.from('message_threads').insert({ athlete_id: athlete.id, coach_id: coach.id }).select().single()
    const { data: t2 } = await sql.from('message_threads').insert({ athlete_id: otherAthlete.id, coach_id: coach.id }).select().single()
    threadId = t1!.id; otherThreadId = t2!.id
    const { data: m } = await coach.client.from('messages')
      .insert({ thread_id: threadId, from_user_id: coach.id, kind: 'text', body: 'How did the tempo feel?' })
      .select().single()
    originalId = m.id
  })

  it('a reply in the same thread keeps reply_to_id', async () => {
    const { data, error } = await athlete.client.from('messages')
      .insert({ thread_id: threadId, from_user_id: athlete.id, kind: 'text', body: 'Strong!', reply_to_id: originalId })
      .select().single()
    expect(error).toBeNull()
    expect(data.reply_to_id).toBe(originalId)
  })

  it('a reply cannot quote a message from another thread', async () => {
    const { error } = await coach.client.from('messages')
      .insert({ thread_id: otherThreadId, from_user_id: coach.id, kind: 'text', body: 'leak', reply_to_id: originalId })
    expect(error?.message).toMatch(/same thread/)
  })

  it('deleting the original keeps the reply with reply_to_id = null', async () => {
    const sql = admin()
    const { data: orig } = await sql.from('messages')
      .insert({ thread_id: threadId, from_user_id: coach.id, kind: 'text', body: 'temp' }).select().single()
    const { data: reply } = await sql.from('messages')
      .insert({ thread_id: threadId, from_user_id: athlete.id, kind: 'text', body: 'ok', reply_to_id: orig!.id }).select().single()
    await sql.from('messages').delete().eq('id', orig!.id)
    const { data: after } = await sql.from('messages').select('reply_to_id').eq('id', reply!.id).single()
    expect(after!.reply_to_id).toBeNull()
  })
})

describe('message immutability', () => {
  it('a participant cannot rewrite reply_to_id or workout_id; marking read still works', async () => {
    const coach = await createAndSignIn({ role: 'coach', name: `Coach ${randomUUID()}`, title: 'Head Coach' })
    const athlete = await createAndSignIn({ role: 'athlete', name: 'Immutable Athlete' })
    const sql = admin()
    await sql.from('coach_athlete').insert({ coach_id: coach.id, athlete_id: athlete.id, relationship: 'head' })
    const { data: t } = await sql.from('message_threads').insert({ athlete_id: athlete.id, coach_id: coach.id }).select().single()
    const { data: a } = await sql.from('messages').insert({ thread_id: t!.id, from_user_id: coach.id, kind: 'text', body: 'a' }).select().single()
    const { data: b } = await sql.from('messages').insert({ thread_id: t!.id, from_user_id: coach.id, kind: 'text', body: 'b' }).select().single()

    const rewrite = await athlete.client.from('messages').update({ reply_to_id: a!.id }).eq('id', b!.id)
    expect(rewrite.error?.message).toMatch(/only the read flag/)
    const read = await athlete.client.from('messages').update({ read: true }).eq('id', b!.id)
    expect(read.error).toBeNull()
  })
})

describe('message immutability vs. deletes', () => {
  it('deleting a workout still clears workout_id on messages that referenced it', async () => {
    const coach = await createAndSignIn({ role: 'coach', name: `Coach ${randomUUID()}`, title: 'Head Coach' })
    const athlete = await createAndSignIn({ role: 'athlete', name: 'Workout Ref Athlete' })
    const sql = admin()
    await sql.from('coach_athlete').insert({ coach_id: coach.id, athlete_id: athlete.id, relationship: 'head' })
    const { data: plan } = await sql.from('plans').insert({ athlete_id: athlete.id, plan_week: 1, plan_weeks: 12 }).select().single()
    const { data: w } = await sql.from('workouts').insert({ plan_id: plan!.id, athlete_id: athlete.id, date: '2026-10-18', type: 'easy', title: 'Easy', status: 'planned' }).select().single()
    const { data: t } = await sql.from('message_threads').insert({ athlete_id: athlete.id, coach_id: coach.id }).select().single()
    const { data: m } = await sql.from('messages').insert({ thread_id: t!.id, from_user_id: coach.id, kind: 'workout', workout_id: w!.id, payload: { title: 'Easy' } }).select().single()
    // The FK clean-up runs as the table owner (not service_role) whoever
    // deletes, so this exercises the guard's set-null allowance.
    const del = await sql.from('workouts').delete().eq('id', w!.id)
    expect(del.error).toBeNull()
    const { data: after } = await sql.from('messages').select('workout_id').eq('id', m!.id).single()
    expect(after!.workout_id).toBeNull()
  })
})
