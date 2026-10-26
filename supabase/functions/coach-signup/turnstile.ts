// Cloudflare's public TEST secret accepts every token. It is only a fallback on
// the local stack, where SUPABASE_URL points at the local gateway. Anywhere else
// a missing TURNSTILE_SECRET_KEY returns '' so every signup is rejected instead
// of letting bots through.
export const TEST_SECRET = '1x0000000000000000000000000000000AA'

const LOCAL_URL = /^http:\/\/(kong|localhost|127\.0\.0\.1)(:|\/|$)/

export function turnstileSecret(configured: string | undefined, supabaseUrl: string | undefined): string {
  if (configured) return configured
  return LOCAL_URL.test(supabaseUrl ?? '') ? TEST_SECRET : ''
}
