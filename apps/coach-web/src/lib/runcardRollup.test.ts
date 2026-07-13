import { supersededCardIds } from './runcardRollup'
import type { Message } from './types'

const msg = (id: string, kind: string, workout_id: string | null): Message =>
  ({ id, kind, workout_id, thread_id: 't', from_user_id: 'a', body: null, payload: null, read: true, created_at: id } as Message)

test('older runcards for the same workout are superseded by the newest', () => {
  const ids = supersededCardIds([
    msg('1', 'runcard', 'w1'),
    msg('2', 'text', null),
    msg('3', 'runcard', 'w1'),   // re-shared after an edit
    msg('4', 'runcard', 'w2'),   // different workout — untouched
  ])
  expect(ids).toEqual(new Set(['1']))
})

test('re-shared coach workout cards roll up the same way', () => {
  const ids = supersededCardIds([
    msg('1', 'workout', 'w1'),
    msg('2', 'workout', 'w1'),   // coach shared again after editing
  ])
  expect(ids).toEqual(new Set(['1']))
})

test('a runcard never supersedes a workout card (result vs prescription)', () => {
  const ids = supersededCardIds([
    msg('1', 'workout', 'w1'),
    msg('2', 'runcard', 'w1'),
  ])
  expect(ids.size).toBe(0)
})

test('legacy cards without workout_id never roll up', () => {
  const ids = supersededCardIds([
    msg('1', 'runcard', null),
    msg('2', 'runcard', null),
  ])
  expect(ids.size).toBe(0)
})
