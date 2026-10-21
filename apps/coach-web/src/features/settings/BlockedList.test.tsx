import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import * as mod from '../../lib/queries/moderation'
import { BlockedList } from './BlockedList'

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

test('lists blocked people and unblocks', () => {
  const unblock = { mutate: vi.fn(), isPending: false }
  vi.spyOn(mod, 'useBlockedUsers').mockReturnValue({ data: [{ user_id: 'u9', name: 'Pat Pest', initials: 'PP', avatar_url: null }] } as any)
  vi.spyOn(mod, 'useUnblock').mockReturnValue(unblock as any)
  wrap(<BlockedList />)
  fireEvent.click(screen.getByRole('button', { name: 'Unblock Pat Pest' }))
  expect(unblock.mutate).toHaveBeenCalledWith('u9')
})

test('says so when nobody is blocked', () => {
  vi.spyOn(mod, 'useBlockedUsers').mockReturnValue({ data: [] } as any)
  vi.spyOn(mod, 'useUnblock').mockReturnValue({ mutate: vi.fn() } as any)
  wrap(<BlockedList />)
  expect(screen.getByText("You haven't blocked anyone.")).toBeInTheDocument()
})
