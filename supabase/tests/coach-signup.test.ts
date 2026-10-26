import 'dotenv/config'
import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, signIn } from './helpers'

const FN_URL = `${process.env.SUPABASE_URL}/functions/v1/coach-signup`

// Cloudflare's dummy token; the function's default test secret accepts it.
const CAPTCHA = 'XXXX.DUMMY.TOKEN.XXXX'

async function callSignup(body: Record<string, unknown>) {
  const res = await fetch(FN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: process.env.SUPABASE_ANON_KEY! },
    body: JSON.stringify({ captchaToken: CAPTCHA, ...body }),
  })
  return { status: res.status, json: await res.json().catch(() => ({})) }
}

describe('coach-signup edge function', () => {
  it('creates a coach with the chosen title, who can sign in once their email is confirmed', async () => {
    const email = `coach-${randomUUID()}@test.recbuddy.app`
    const { status, json } = await callSignup({ name: 'Edge Coach', email, password: 'test-password-123', title: 'Head Coach' })
    expect(status).toBe(200)
    // Signup doesn't auto-confirm (stops account squatting); confirm as the email link would.
    await admin().auth.admin.updateUserById(json.id, { email_confirm: true })
    const client = await signIn(email, 'test-password-123')
    const { data } = await client.from('profiles').select('role,title').eq('email', email).single()
    expect(data!.role).toBe('coach')
    expect(data!.title).toBe('Head Coach')
  })

  it('refuses signup without a passing captcha', async () => {
    const { status } = await callSignup({ name: 'Bot', email: `bot-${randomUUID()}@test.recbuddy.app`, password: 'test-password-123', title: 'Head Coach', captchaToken: '' })
    expect(status).toBe(400)
  })

  it('rejects a duplicate email', async () => {
    const email = `dupe-${randomUUID()}@test.recbuddy.app`
    await callSignup({ name: 'A', email, password: 'test-password-123', title: 'Head Coach' })
    const { status } = await callSignup({ name: 'B', email, password: 'test-password-123', title: 'Head Coach' })
    expect(status).toBeGreaterThanOrEqual(400)
  })
})
