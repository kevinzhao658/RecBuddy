import { render } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useConversations } from './conversations'
import { useUnreadRealtime, useRealtimeThread } from './chat'
import { useReactions } from './reactions'
import { useRealtimePlan } from '../useRealtimePlan'

// Mirrors realtime-js 2.108: channel(topic) returns the already-open channel
// for that topic, and adding postgres_changes callbacks after subscribe() throws.
function mimicRealtime() {
  const open = new Map<string, any>()
  vi.spyOn(supabase, 'channel').mockImplementation(((topic: string) => {
    const existing = open.get(topic)
    if (existing) return existing
    let subscribed = false
    const ch: any = {
      on: () => { if (subscribed) throw new Error(`cannot add postgres_changes callbacks for ${topic} after subscribe()`); return ch },
      subscribe: () => { subscribed = true; return ch },
    }
    open.set(topic, ch)
    return ch
  }) as any)
  vi.spyOn(supabase, 'removeChannel').mockResolvedValue('ok' as any)
  vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: [], error: null } as any)
  vi.spyOn(supabase, 'from').mockReturnValue({ select: () => ({ eq: () => Promise.resolve({ data: [], error: null }) }) } as any)
}

function Hooks() {
  useConversations('me')
  useUnreadRealtime()
  useRealtimeThread('t1')
  useReactions('t1')
  useRealtimePlan('a1')
  return null
}

afterEach(() => vi.restoreAllMocks())

test('every realtime hook can be mounted twice at once (sidebar + page, phone drawer)', () => {
  mimicRealtime()
  expect(() => render(
    <QueryClientProvider client={new QueryClient()}>
      <Hooks />
      <Hooks />
    </QueryClientProvider>)).not.toThrow()
})
