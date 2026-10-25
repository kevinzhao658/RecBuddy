import { expiryLabel, videoState } from './videoExpiry'

const now = new Date('2026-10-25T12:00:00Z')
const inHours = (h: number) => new Date(now.getTime() + h * 3600_000).toISOString()

test('expiry label counts whole days, then says today', () => {
  expect(expiryLabel(inHours(3 * 24 + 2), now)).toBe('Expires in 3 days')
  expect(expiryLabel(inHours(24 + 5), now)).toBe('Expires in 1 day')
  expect(expiryLabel(inHours(20), now)).toBe('Expires today')
  expect(expiryLabel(inHours(-1), now)).toBeNull()
})

test('a local copy always plays, even after the server copy is gone', () => {
  expect(videoState({ hasLocal: true, purged: true, expired: true })).toBe('local')
  expect(videoState({ hasLocal: false, purged: true, expired: true })).toBe('expired')
  expect(videoState({ hasLocal: false, purged: false, expired: true })).toBe('expired')
  expect(videoState({ hasLocal: false, purged: false, expired: false })).toBe('remote')
})
