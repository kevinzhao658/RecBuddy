/** True only when the caller sent the configured shared secret. With no secret
 *  configured, nobody is let in. */
export function purgeAuthorized(sent: string | null, secret: string | undefined): boolean {
  if (!secret || !sent || sent.length !== secret.length) return false
  let diff = 0
  for (let i = 0; i < secret.length; i++) diff |= sent.charCodeAt(i) ^ secret.charCodeAt(i)
  return diff === 0
}
