/** Supabase auth redirects report failures as `#error=…&error_description=…`. */
export function parseAuthError(hash: string): { error: string; description: string } | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''))
  const error = params.get('error')
  if (!error) return null
  return { error, description: params.get('error_description') ?? '' }
}

/** Token from a recovery email built on the token-hash template:
 *  `/reset-password?token_hash=…&type=recovery`. Works no matter which client
 *  (web implicit or iOS PKCE) requested the reset. */
export function recoveryTokenHash(search: string): string | null {
  const params = new URLSearchParams(search)
  return params.get('type') === 'recovery' ? params.get('token_hash') : null
}
