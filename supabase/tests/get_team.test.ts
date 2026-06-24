import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createAndSignIn } from './helpers'

describe('get_team RPC', () => {
  let head: any, assistant: any, athleteId: string

  beforeAll(async () => {
    head = await createAndSignIn({ role: 'coach', name: `Head ${randomUUID()}`, title: 'Head Coach' })
    assistant = await createAndSignIn({ role: 'coach', name: `Asst ${randomUUID()}`, title: 'Assistant Coach' })
    const athlete = await createAndSignIn({ role: 'athlete', name: 'Teamed Athlete' })
    athleteId = athlete.id
    // head links to the athlete via the proper invite flow, then adds the assistant
    const { data: code } = await head.client.rpc('create_invite', { p_athlete_name: 'x' })
    await athlete.client.rpc('redeem_invite', { p_code: code })
    await head.client.from('coach_athlete').insert({ coach_id: assistant.id, athlete_id: athleteId, relationship: 'assistant' })
  })

  it('returns the full team incl. the co-coach name a plain embed would hide as null', async () => {
    const { data, error } = await head.client.rpc('get_team', { p_athlete_id: athleteId })
    expect(error).toBeNull()
    const rows = data as any[]
    expect(rows.length).toBe(2)
    expect(rows.every((r) => r.name && r.initials)).toBe(true) // no null coach display
    expect(rows.some((r) => r.relationship === 'head')).toBe(true)
    expect(rows.some((r) => r.relationship === 'assistant')).toBe(true)
  })

  it('a coach who does not coach the athlete gets nothing', async () => {
    const stranger = await createAndSignIn({ role: 'coach', name: `Stranger ${randomUUID()}`, title: 'Head Coach' })
    const { data } = await stranger.client.rpc('get_team', { p_athlete_id: athleteId })
    expect(data ?? []).toEqual([])
  })
})
