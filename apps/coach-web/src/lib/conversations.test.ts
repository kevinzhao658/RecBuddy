import { conversationTitle, previewLine, pendingConversation } from './conversations'

const m = (user_id: string, name: string) => ({ user_id, name, initials: 'X', avatar_url: null })
const base = { thread_id: 't', kind: 'chat', title: null, team_athlete_id: null, members: [] as any[],
  last_body: 'Meet at 7', last_kind: 'text', last_from: 'u2', last_at: '2026-10-21T14:00:00Z', unread: 0, read_only: false }

test('titles: group name, then everyone else in the chat (team chats too, athlete first)', () => {
  expect(conversationTitle({ ...base, title: 'Crew' } as any)).toBe('Crew')
  expect(conversationTitle({ ...base, members: [m('a', 'Dani Brooks')] } as any)).toBe('Dani Brooks')
  expect(conversationTitle({ ...base, members: [m('a', 'Dani Brooks'), m('b', 'Marcus Hale')] } as any)).toBe('Dani & Marcus')
  expect(conversationTitle({ ...base, members: [m('a', 'Dani Brooks'), m('b', 'Marcus Hale'), m('c', 'Bea Lin')] } as any)).toBe('Dani, Marcus & Bea')
  expect(conversationTitle({ ...base, kind: 'team', team_athlete_id: 'ath', members: [m('b', 'Bea Lin'), m('ath', 'Maya Chen')] } as any))
    .toBe('Maya & Bea')
  expect(conversationTitle({ ...base, kind: 'team', team_athlete_id: 'ath', members: [m('ath', 'Maya Chen')] } as any)).toBe('Maya Chen')
})

test('preview line: You:, group sender prefix, and card kinds', () => {
  expect(previewLine({ ...base, last_from: 'me' } as any, 'me')).toBe('You: Meet at 7')
  expect(previewLine({ ...base, members: [m('u2', 'Dani Brooks'), m('u3', 'Bea Lin')] } as any, 'me')).toBe('Dani: Meet at 7')
  expect(previewLine({ ...base, last_kind: 'image', last_body: null } as any, 'me')).toBe('📷 Photo')
  expect(previewLine({ ...base, last_kind: null, last_at: null } as any, 'me')).toBe('No messages yet')
})

test('pendingConversation builds a header row for a chat with no messages yet', () => {
  const people = [
    { user_id: 'me', name: 'Dani Brooks', initials: 'DB', avatar_url: null, title: null, current: true },
    { user_id: 'a1', name: 'Maya Chen', initials: 'MC', avatar_url: null, title: null, current: true },
    { user_id: 'a2', name: 'Left Person', initials: 'LP', avatar_url: null, title: null, current: false },
  ]
  expect(pendingConversation('t9', { kind: 'chat', title: 'Crew', read_only: false }, people, 'me')).toEqual({
    thread_id: 't9', kind: 'chat', title: 'Crew', team_athlete_id: null,
    members: [{ user_id: 'a1', name: 'Maya Chen', initials: 'MC', avatar_url: null }],
    last_body: null, last_kind: null, last_from: null, last_at: null, unread: 0, read_only: false,
  })
})
