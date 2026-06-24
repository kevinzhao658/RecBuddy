import { render, screen } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { TeamPopover } from './TeamPopover'
import * as team from '../../lib/queries/team'

test('renders the team avatar cluster', () => {
  vi.spyOn(team, 'useTeam').mockReturnValue({ data: [{ coach_id: 'c1', relationship: 'head', coach: { name: 'Mara Whitlock', title: 'Head Coach', initials: 'MW' } }], isLoading: false } as any)
  vi.spyOn(team, 'useSearchCoaches').mockReturnValue({ mutate: vi.fn(), data: [], isPending: false } as any)
  vi.spyOn(team, 'useAddAssistant').mockReturnValue({ mutate: vi.fn() } as any)
  vi.spyOn(team, 'useRemoveAssistant').mockReturnValue({ mutate: vi.fn() } as any)
  render(<QueryClientProvider client={new QueryClient()}><TeamPopover athleteId="a1" isHead={true} /></QueryClientProvider>)
  expect(screen.getByText('MW')).toBeInTheDocument()
})
