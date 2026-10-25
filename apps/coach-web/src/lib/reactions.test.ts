import { REACTIONS, summarize } from './reactions'

const r = (message_id: string, user_id: string, kind: string | null) => ({ message_id, user_id, kind }) as any

test('the five reactions in canonical order', () => {
  expect(REACTIONS.map((x) => x.emoji)).toEqual(['👍', '‼️', '❓', '😂', '🎉'])
})

test('summarize groups by kind in canonical order, ignores removed, marks mine, lists names', () => {
  const rs = [r('m1', 'me', 'congrats'), r('m1', 'u2', 'like'), r('m1', 'u3', 'congrats'), r('m1', 'u4', null), r('m2', 'u2', 'laugh')]
  const out = summarize(rs, 'm1', 'me', (id) => (id === 'me' ? 'You' : id))
  expect(out.map((x) => [x.kind, x.count, x.mine])).toEqual([['like', 1, false], ['congrats', 2, true]])
  expect(out[1].names).toEqual(['You', 'u3'])
  expect(out[1].emoji).toBe('🎉')
})

test('one person can hold several kinds on a message; inactive rows are ignored', () => {
  const rs = [
    { message_id: 'm1', user_id: 'me', kind: 'laugh', active: true },
    { message_id: 'm1', user_id: 'me', kind: 'question', active: true },
    { message_id: 'm1', user_id: 'me', kind: 'like', active: false },
  ] as any
  const out = summarize(rs, 'm1', 'me', () => 'You')
  expect(out.map((x) => [x.kind, x.count, x.mine])).toEqual([['question', 1, true], ['laugh', 1, true]])
})
