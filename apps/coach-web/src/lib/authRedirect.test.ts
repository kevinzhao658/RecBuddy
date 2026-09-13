import { parseAuthError, recoveryTokenHash } from './authRedirect'

describe('parseAuthError', () => {
  test('returns null without an error fragment', () => {
    expect(parseAuthError('')).toBeNull()
    expect(parseAuthError('#access_token=abc&type=recovery')).toBeNull()
  })

  test('decodes the error and description', () => {
    expect(parseAuthError('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'))
      .toEqual({ error: 'access_denied', description: 'Email link is invalid or has expired' })
  })
})

describe('recoveryTokenHash', () => {
  test('reads the token hash from a recovery link', () => {
    expect(recoveryTokenHash('?token_hash=pkce_abc123&type=recovery')).toBe('pkce_abc123')
  })

  test('ignores other link types and missing tokens', () => {
    expect(recoveryTokenHash('?token_hash=abc&type=signup')).toBeNull()
    expect(recoveryTokenHash('?type=recovery')).toBeNull()
    expect(recoveryTokenHash('?code=abc')).toBeNull()
  })
})
