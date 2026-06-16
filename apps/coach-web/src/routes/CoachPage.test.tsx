import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import CoachPage from './CoachPage'
import * as roster from '../lib/queries/roster'
import * as invites from '../lib/queries/invites'
import * as authMod from '../auth/AuthProvider'

test('shows the empty state until an athlete is selected', () => {
  vi.spyOn(authMod, 'useAuth').mockReturnValue({ session: { user: { id: 'c1' } }, role: 'coach', loading: false } as any)
  vi.spyOn(roster, 'useRoster').mockReturnValue({ data: [], isLoading: false } as any)
  vi.spyOn(invites, 'usePendingInvites').mockReturnValue({ data: [], isLoading: false } as any)
  vi.spyOn(roster, 'useRemoveAthlete').mockReturnValue({ mutate: vi.fn() } as any)
  vi.spyOn(invites, 'useRevokeInvite').mockReturnValue({ mutate: vi.fn() } as any)
  vi.spyOn(invites, 'useCreateInvite').mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><CoachPage /></MemoryRouter></QueryClientProvider>)
  expect(screen.getByText(/select an athlete/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /log out/i })).toBeInTheDocument()
})
