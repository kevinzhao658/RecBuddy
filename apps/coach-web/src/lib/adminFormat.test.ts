import { describeMessage, hoursSince, reasonLabel, actionLabel, fmtWhen, filterSortReports } from './adminFormat'

test('reason and action labels fall back to the raw value', () => {
  expect(reasonLabel('hate')).toBe('Hate speech or slurs')
  expect(reasonLabel('new-thing')).toBe('new-thing')
  expect(actionLabel('suspend')).toBe('Suspended user')
})

test('describeMessage covers every kind', () => {
  expect(describeMessage({ kind: 'text', body: 'hi' })).toBe('hi')
  expect(describeMessage({ kind: 'image', body: 'look' })).toBe('[Photo] look')
  expect(describeMessage({ kind: 'workout', payload: { title: 'Tempo' } })).toBe('[Workout] Tempo')
  expect(describeMessage({ kind: 'runcard', payload: { title: 'Easy', note: 'tired' } })).toBe('[Logged run] Easy — tired')
  expect(describeMessage({ kind: 'adjust', payload: { from: 'A', to: 'B' } })).toBe('[Plan change] A → B')
  expect(describeMessage(null)).toMatch(/reported directly/)
})

test('hoursSince and fmtWhen', () => {
  expect(hoursSince('2026-10-18T00:00:00Z', new Date('2026-10-19T06:00:00Z'))).toBe(30)
  expect(fmtWhen(null)).toBe('—')
  expect(fmtWhen('garbage')).toBe('—')
})


const row = (o: Partial<Parameters<typeof filterSortReports>[0][number]>) => ({
  reason: 'spam', created_at: '2026-10-18T10:00:00Z', reported_name: 'Marcus Hale', reported_email: 'm@x.app',
  reporter_name: 'Maya Chen', reporter_email: 'maya@x.app', details: null, reported_open_reports: 1,
  content_snapshot: { kind: 'text', body: 'hello' }, ...o,
})
const NOW = new Date('2026-10-19T12:00:00Z')

test('filters by reason, overdue, and free text across names/emails/content', () => {
  const rows = [
    row({ reason: 'hate', created_at: '2026-10-19T11:00:00Z' }),
    row({ reason: 'spam', reported_name: 'Dani Brooks', content_snapshot: { kind: 'text', body: 'buy crypto' } }),
  ]
  expect(filterSortReports(rows, { reason: 'hate' }, NOW)).toHaveLength(1)
  expect(filterSortReports(rows, { overdueOnly: true }, NOW).map((r) => r.reason)).toEqual(['spam'])
  expect(filterSortReports(rows, { q: 'CRYPTO' }, NOW)[0].reported_name).toBe('Dani Brooks')
  expect(filterSortReports(rows, { q: 'maya@x' }, NOW)).toHaveLength(2)
})

test('sorts newest, oldest, most-reported, and by reason', () => {
  const a = row({ reason: 'violence', created_at: '2026-10-17T00:00:00Z', reported_open_reports: 1 })
  const b = row({ reason: 'harassment', created_at: '2026-10-18T00:00:00Z', reported_open_reports: 5 })
  const c = row({ reason: 'spam', created_at: '2026-10-19T00:00:00Z', reported_open_reports: 2 })
  const order = (s: any) => filterSortReports([a, b, c], { sort: s }, NOW).map((r) => r.reason)
  expect(order('newest')).toEqual(['spam', 'harassment', 'violence'])
  expect(order('oldest')).toEqual(['violence', 'harassment', 'spam'])
  expect(order('most_reported')).toEqual(['harassment', 'spam', 'violence'])
  expect(order('reason')).toEqual(['harassment', 'spam', 'violence']) // Harassment, Spam, Threats…
})

test('starred-only and unread-only filters', () => {
  const rows = [row({ starred: true, read_at: null }), row({ starred: false, read_at: '2026-10-18T12:00:00Z' })]
  expect(filterSortReports(rows, { starredOnly: true }, NOW)).toHaveLength(1)
  expect(filterSortReports(rows, { unreadOnly: true }, NOW)[0].starred).toBe(true)
})
