import 'dotenv/config'
import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, signIn } from './helpers'

const FN_URL = `${process.env.SUPABASE_URL}/functions/v1/coach-signup`

async function callSignup(body: unknown) {
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: process.env.SUPABASE_ANON_KEY! },
    body: JSON.stringify(body),
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

describe('coach-signup edge function', () => {
  it('creates a coach with the chosen title, who can then sign in', async () => {
    const email = `coach-${randomUUID()}@test.recbuddy.app`
    const { status } = await callSignup({ name: 'Edge Coach', email, password: 'test-password-123', title: 'Head Coach' })
    expect(status).toBe(200)
    const client = await signIn(email, 'test-password-123')
    const { data } = await client.from('profiles').select('role,title').eq('email', email).single()
    expect(data!.role).toBe('coach')
    expect(data!.title).toBe('Head Coach')
  })

  it('rejects a duplicate email', async () => {
    const email = `dupe-${randomUUID()}@test.recbuddy.app`
    await callSignup({ name: 'A', email, password: 'test-password-123', title: 'Head Coach' })
    const { status } = await callSignup({ name: 'B', email, password: 'test-password-123', title: 'Head Coach' })
    expect(status).toBeGreaterThanOrEqual(400)
  })
})
