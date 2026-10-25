import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useUnblock } from './moderation'

test('unblocking refreshes everything a block hid (inbox, roster, messages, search), not just the list', async () => {
  vi.spyOn(supabase.auth, 'getUser').mockResolvedValue({ data: { user: { id: 'me' } } } as any)
  const chain: any = { delete: () => chain, eq: () => chain, then: (r: any) => r({ error: null }) }
  vi.spyOn(supabase, 'from').mockReturnValue(chain)
  const qc = new QueryClient()
  const spy = vi.spyOn(qc, 'invalidateQueries')
  const { result } = renderHook(() => useUnblock(), {
    wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
  })
  result.current.mutate('u1')
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey[0])
  expect(keys).toEqual(expect.arrayContaining(['conversations', 'blocked', 'roster', 'unread', 'messages', 'search-people']))
})
