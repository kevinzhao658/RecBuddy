import 'dotenv/config'
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, anon, createAndSignIn, resetRateLimits } from './helpers'

const URL = process.env.SUPABASE_URL!
const ANON = process.env.SUPABASE_ANON_KEY!

async function rpcStatus(fn: string, body: Record<string, unknown>) {
  const res = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: ANON, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return res.status
}

describe('rate-limited public lookups', () => {
  beforeEach(resetRateLimits)
  afterAll(resetRateLimits)

  it('email_has_account answers 429 after 20 checks from one IP', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 21; i++) statuses.push(await rpcStatus('email_has_account', { p_email: `n-${i}@test.recbuddy.app` }))
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true)
    expect(statuses[20]).toBe(429)
  })

  it('resolve_invite answers 429 after 30 lookups from one IP', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 31; i++) statuses.push(await rpcStatus('resolve_invite', { p_code: `GUESS${i}` }))
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true)
    expect(statuses[30]).toBe(429)
  })

  it('keeps the counters out of reach of clients', async () => {
    await rpcStatus('email_has_account', { p_email: 'x@test.recbuddy.app' })
    const { data, error } = await anon().from('rpc_rate_limits').select('*')
    expect(error !== null || (data ?? []).length === 0).toBe(true)
    const { error: callErr } = await anon().rpc('rate_limit_hit', { p_bucket: 'x', p_max: 1, p_window: '1 minute' })
    expect(callErr).not.toBeNull()
    const { count } = await admin().from('rpc_rate_limits').select('*', { count: 'exact', head: true })
    expect(count).toBeGreaterThan(0)
  })
})

describe('create_invite codes', () => {
  it('are 8 characters from the unambiguous alphabet', async () => {
    const { client } = await createAndSignIn({ role: 'coach', name: 'Code Coach' })
    const codes = new Set<string>()
    for (let i = 0; i < 20; i++) {
      const { data, error } = await client.rpc('create_invite', { p_athlete_name: `Athlete ${randomUUID().slice(0, 4)}` })
      expect(error).toBeNull()
      codes.add(data as string)
    }
    expect(codes.size).toBe(20)
    for (const c of codes) expect(c).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/)
  })
})
