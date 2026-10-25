import { copyText, quotePreview } from './messageText'

const base = { id: 'm1', thread_id: 't', from_user_id: 'u', workout_id: null, read: false, created_at: '2026-10-18T10:00:00Z' }
const msg = (kind: string, body: string | null, payload: unknown = null) => ({ ...base, kind, body, payload }) as any

test('text and captions copy their body; bare photos copy nothing', () => {
  expect(copyText(msg('text', 'See you at 6'), 'mi')).toBe('See you at 6')
  expect(copyText(msg('image', 'Finish line!', { path: 'x' }), 'mi')).toBe('Finish line!')
  expect(copyText(msg('image', null, { path: 'x' }), 'mi')).toBeNull()
})

test('run card copies a stat summary with the note', () => {
  const m = msg('runcard', null, { title: 'Tempo 6 mi', dist: '6.0 mi', pace: '7:42', time: '46:12', hr: 158, note: 'Felt strong' })
  expect(copyText(m, 'mi')).toBe('Tempo 6 mi — 6.0 mi · 7:42/mi · 46:12 · Avg HR 158\n"Felt strong"')
  expect(copyText(msg('runcard', null, { title: 'Easy', dist: '4 mi' }), 'mi')).toBe('Easy — 4 mi')
})

test('workout copies in the display unit', () => {
  const m = msg('workout', null, { title: 'Long Run', dist: 10, pace: '9:00', type: 'long', date: '2026-10-18' })
  expect(copyText(m, 'mi')).toBe('Long Run — 10 mi · 9:00/mi')
  expect(copyText(m, 'km')).toBe('Long Run — 16.1 km · 5:36/km')
})

test('adjust copies from → to plus reason', () => {
  expect(copyText(msg('adjust', null, { from: '6 × 800m', to: '4 × 1 mi', reason: 'Ready for more' }), 'mi'))
    .toBe('Workout adjusted: 6 × 800m → 4 × 1 mi\nReady for more')
})

test('quote previews are one line per kind', () => {
  expect(quotePreview(msg('text', 'Line one\nline two'))).toBe('Line one line two')
  expect(quotePreview(msg('image', null, { path: 'x' }))).toBe('📷 Photo')
  expect(quotePreview(msg('image', 'Finish', { path: 'x' }))).toBe('📷 Finish')
  expect(quotePreview(msg('runcard', null, { title: 'Tempo 6 mi' }))).toBe('Logged run · Tempo 6 mi')
  expect(quotePreview(msg('workout', null, { title: 'Long Run' }))).toBe('Workout · Long Run')
  expect(quotePreview(msg('adjust', null, { from: 'a', to: 'b' }))).toBe('Workout adjusted · b')
})
