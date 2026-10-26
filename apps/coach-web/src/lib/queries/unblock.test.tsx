import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from '../supabase'
import { useUnblock } from './moderation'

test('unblocking refreshes everything a block hid (inbox, roster, messages, search), not just the list', async () => {
  const rpc = vi.spyOn(supabase, 'rpc').mockResolvedValue({ data: null, error: null } as any)
  const qc = new QueryClient()
  const spy = vi.spyOn(qc, 'invalidateQueries')
  const { result } = renderHook(() => useUnblock(), {
    wrapper: ({ children }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
  })
  result.current.mutate('u1')
  await waitFor(() => expect(result.current.isSuccess).toBe(true))
  // The server restores what the block took away (team link, chats), so unblock goes through the RPC.
  expect(rpc).toHaveBeenCalledWith('unblock_user', { p_user_id: 'u1' })
  const keys = spy.mock.calls.map((c) => (c[0] as any).queryKey[0])
  expect(keys).toEqual(expect.arrayContaining(['conversations', 'blocked', 'roster', 'unread', 'messages', 'search-people']))
})
