import { render, screen } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { RosterSidebar } from './RosterSidebar'
import * as roster from '../../lib/queries/roster'
import * as invites from '../../lib/queries/invites'
import * as authMod from '../../auth/AuthProvider'

function wrap(ui: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

test('shows active athletes and dimmed pending invite rows', () => {
  vi.spyOn(authMod, 'useAuth').mockReturnValue({ session: { user: { id: 'c1' } }, role: 'coach', loading: false } as any)
  vi.spyOn(roster, 'useRoster').mockReturnValue({ data: [{ relationship: 'head', athlete: { id: 'a1', name: 'Rita Real', initials: 'RR' }, plans: [{ goal_date: 'Aug 23', plan_week: 5, plan_weeks: 16 }] }], isLoading: false } as any)
  vi.spyOn(invites, 'usePendingInvites').mockReturnValue({ data: [{ id: 'i1', code: 'ABCD2345', athlete_name: 'Pending Pat' }], isLoading: false } as any)
  vi.spyOn(roster, 'useRemoveAthlete').mockReturnValue({ mutate: vi.fn() } as any)
  vi.spyOn(invites, 'useRevokeInvite').mockReturnValue({ mutate: vi.fn() } as any)
  vi.spyOn(invites, 'useCreateInvite').mockReturnValue({ mutate: vi.fn(), isPending: false } as any)

  wrap(<RosterSidebar selectedId={'a1'} onSelect={() => {}} />)
  expect(screen.getByText('Rita Real')).toBeInTheDocument()
  expect(screen.getByText('Pending Pat')).toBeInTheDocument()
  expect(screen.getByText('ABCD2345')).toBeInTheDocument()
})
