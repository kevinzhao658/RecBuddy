import { describe, it, expect } from 'vitest'
import { turnstileSecret, TEST_SECRET } from '../functions/coach-signup/turnstile.ts'

describe('coach-signup Turnstile secret', () => {
  it('uses the configured secret everywhere', () => {
    expect(turnstileSecret('real', 'https://abc.supabase.co')).toBe('real')
    expect(turnstileSecret('real', 'http://kong:8000')).toBe('real')
  })

  it('falls back to the always-pass test secret only on the local stack', () => {
    expect(turnstileSecret(undefined, 'http://kong:8000')).toBe(TEST_SECRET)
    expect(turnstileSecret('', 'http://127.0.0.1:54321')).toBe(TEST_SECRET)
    expect(turnstileSecret(undefined, 'http://localhost:54321')).toBe(TEST_SECRET)
  })

  it('returns no secret (so signup is refused) when a hosted project lacks one', () => {
    expect(turnstileSecret(undefined, 'https://abc.supabase.co')).toBe('')
    expect(turnstileSecret(undefined, 'http://localhost.evil.com')).toBe('')
    expect(turnstileSecret(undefined, undefined)).toBe('')
  })
})
