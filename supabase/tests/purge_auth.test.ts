import { describe, it, expect } from 'vitest'
import { purgeAuthorized } from '../functions/purge-chat-videos/auth.ts'

// The daily purge is called by pg_cron with a shared secret from Vault, not an
// API key: the gateway only passes JWT keys, and the function's own service key
// isn't guaranteed to be the same legacy JWT.
describe('purge-chat-videos caller check', () => {
  it('accepts the shared secret', () => {
    expect(purgeAuthorized('s3cret-value', 's3cret-value')).toBe(true)
  })

  it('refuses a missing or wrong secret', () => {
    expect(purgeAuthorized(null, 's3cret-value')).toBe(false)
    expect(purgeAuthorized('', 's3cret-value')).toBe(false)
    expect(purgeAuthorized('s3cret-valuf', 's3cret-value')).toBe(false)
  })

  it('refuses everyone when the function has no secret configured', () => {
    expect(purgeAuthorized('', '')).toBe(false)
    expect(purgeAuthorized(null, undefined)).toBe(false)
    expect(purgeAuthorized('undefined', undefined)).toBe(false)
  })
})
