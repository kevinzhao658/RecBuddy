import { conversationTitle, previewLine } from './conversations'

const m = (user_id: string, name: string) => ({ user_id, name, initials: 'X', avatar_url: null })
const base = { thread_id: 't', kind: 'chat', title: null, team_athlete_id: null, members: [] as any[],
  last_body: 'Meet at 7', last_kind: 'text', last_from: 'u2', last_at: '2026-10-21T14:00:00Z', unread: 0, read_only: false }

test('titles: group name, one person, two, three, and team chats named after the athlete', () => {
  expect(conversationTitle({ ...base, title: 'Crew' } as any)).toBe('Crew')
  expect(conversationTitle({ ...base, members: [m('a', 'Dani Brooks')] } as any)).toBe('Dani Brooks')
  expect(conversationTitle({ ...base, members: [m('a', 'Dani Brooks'), m('b', 'Marcus Hale')] } as any)).toBe('Dani & Marcus')
  expect(conversationTitle({ ...base, members: [m('a', 'Dani Brooks'), m('b', 'Marcus Hale'), m('c', 'Bea Lin')] } as any)).toBe('Dani, Marcus & Bea')
  expect(conversationTitle({ ...base, kind: 'team', team_athlete_id: 'ath', members: [m('ath', 'Maya Chen'), m('b', 'Marcus Hale')] } as any))
    .toBe('Maya Chen · Team')
})

test('preview line: You:, group sender prefix, and card kinds', () => {
  expect(previewLine({ ...base, last_from: 'me' } as any, 'me')).toBe('You: Meet at 7')
  expect(previewLine({ ...base, members: [m('u2', 'Dani Brooks'), m('u3', 'Bea Lin')] } as any, 'me')).toBe('Dani: Meet at 7')
  expect(previewLine({ ...base, last_kind: 'image', last_body: null } as any, 'me')).toBe('📷 Photo')
  expect(previewLine({ ...base, last_kind: null, last_at: null } as any, 'me')).toBe('No messages yet')
})
