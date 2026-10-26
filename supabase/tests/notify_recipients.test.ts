import { describe, it, expect } from 'vitest'
import { recipients, chatAlert, reactionAlert } from '../functions/notify-message/recipients'

describe('push recipients', () => {
  const team = { kind: 'team', athlete_id: 'ath', title: null }
  const chat = { kind: 'chat', athlete_id: null, title: 'Long-run crew' }
  const members = [
    { user_id: 'ath', status: 'active' },
    { user_id: 'coach', status: 'active' },
    { user_id: 'old', status: 'readonly' },
    { user_id: 'gone', status: 'left' },
    { user_id: 'kicked', status: 'removed' },
  ]

  it('team thread: a coach message goes to the athlete', () => {
    expect(recipients(team, [], 'coach')).toEqual(['ath'])
  })

  it('team thread: the athlete\'s own message notifies nobody', () => {
    expect(recipients(team, [], 'ath')).toEqual([])
  })

  it('chat: every active member except the sender', () => {
    expect(recipients(chat, members, 'coach')).toEqual(['ath'])
    expect(recipients(chat, members, 'ath')).toEqual(['coach'])
  })

  it('group alerts are titled with the group name and prefix the sender', () => {
    expect(chatAlert(chat, 'Dani Brooks', { title: 'Dani Brooks', body: 'Meet at 7' }))
      .toEqual({ title: 'Long-run crew', body: 'Dani Brooks: Meet at 7' })
    expect(chatAlert({ ...chat, title: null }, 'Dani Brooks', { title: 'Dani Brooks', body: 'hi' }))
      .toEqual({ title: 'Dani Brooks', body: 'hi' })
  })

  it('reaction alerts use the emoji for each kind', () => {
    expect(reactionAlert('Dani Brooks', 'like')).toEqual({ title: 'Dani Brooks', body: '👍 your message' })
    expect(reactionAlert('Dani Brooks', 'congrats').body).toBe('🎉 your message')
  })
})

describe('reaction push gate', () => {
  it('pushes only to an author who can still read the chat, never for self or blocked reactors', async () => {
    const { notifyReactionAuthor } = await import('../functions/notify-message/recipients')
    expect(notifyReactionAuthor({ kind: 'team', authorStatus: null, author: 'a', reactor: 'b', authorBlockedReactor: false, authorCanRead: true })).toBe(true)
    expect(notifyReactionAuthor({ kind: 'chat', authorStatus: 'active', author: 'a', reactor: 'b', authorBlockedReactor: false, authorCanRead: true })).toBe(true)
    expect(notifyReactionAuthor({ kind: 'chat', authorStatus: 'left', author: 'a', reactor: 'b', authorBlockedReactor: false, authorCanRead: true })).toBe(false)
    expect(notifyReactionAuthor({ kind: 'chat', authorStatus: 'removed', author: 'a', reactor: 'b', authorBlockedReactor: false, authorCanRead: true })).toBe(false)
    expect(notifyReactionAuthor({ kind: 'chat', authorStatus: null, author: 'a', reactor: 'b', authorBlockedReactor: false, authorCanRead: true })).toBe(false)
    expect(notifyReactionAuthor({ kind: 'team', authorStatus: null, author: 'a', reactor: 'a', authorBlockedReactor: false, authorCanRead: true })).toBe(false)
    expect(notifyReactionAuthor({ kind: 'team', authorStatus: null, author: 'a', reactor: 'b', authorBlockedReactor: true, authorCanRead: true })).toBe(false)
    // a coach removed from the athlete's team no longer hears about their old team-chat messages
    expect(notifyReactionAuthor({ kind: 'team', authorStatus: null, author: 'a', reactor: 'b', authorBlockedReactor: false, authorCanRead: false })).toBe(false)
  })
})

describe('reaction push events', () => {
  it('only the first reaction (an INSERT) pushes; kind switches and re-reacts (UPDATEs) do not', async () => {
    const { isPushableReactionEvent } = await import('../functions/notify-message/recipients')
    expect(isPushableReactionEvent('INSERT', 'like')).toBe(true)
    expect(isPushableReactionEvent('UPDATE', 'like')).toBe(false)
    expect(isPushableReactionEvent('INSERT', null)).toBe(false)
  })
})
