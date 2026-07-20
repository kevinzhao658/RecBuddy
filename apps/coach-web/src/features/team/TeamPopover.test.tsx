import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { TeamPopover } from './TeamPopover'
import * as team from '../../lib/queries/team'

function wrap(ui: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.spyOn(team, 'useSearchCoaches').mockReturnValue({ mutate: vi.fn(), data: [], isPending: false } as any)
  vi.spyOn(team, 'useAddAssistant').mockReturnValue({ mutate: vi.fn() } as any)
  vi.spyOn(team, 'useRemoveAssistant').mockReturnValue({ mutate: vi.fn() } as any)
  vi.spyOn(team, 'useSetCoachPermission').mockReturnValue({ mutate: vi.fn() } as any)
})

test('renders the team avatar cluster', () => {
  vi.spyOn(team, 'useTeam').mockReturnValue({ data: [{ coach_id: 'c1', relationship: 'head', permission: 'admin', coach: { name: 'Mara Whitlock', title: 'Head Coach', initials: 'MW' } }], isLoading: false } as any)
  wrap(<TeamPopover athleteId="a1" isAdmin={true} />)
  expect(screen.getByText('MW')).toBeInTheDocument()
})

test('admin can change a co-coach permission via the segmented control', () => {
  const setPermission = vi.fn()
  vi.spyOn(team, 'useSetCoachPermission').mockReturnValue({ mutate: setPermission } as any)
  vi.spyOn(team, 'useTeam').mockReturnValue({ data: [
    { coach_id: 'c1', relationship: 'head', permission: 'admin', coach: { name: 'Mara Whitlock', title: 'Head Coach', initials: 'MW' } },
    { coach_id: 'c2', relationship: 'assistant', permission: 'read', coach: { name: 'Sam Reed', title: 'Assistant Coach', initials: 'SR' } },
  ], isLoading: false } as any)
  wrap(<TeamPopover athleteId="a1" isAdmin={true} />)
  fireEvent.click(screen.getByRole('button', { name: /manage coaching team/i }))
  fireEvent.click(screen.getByRole('button', { name: /edit access for sam reed/i }))
  expect(setPermission).toHaveBeenCalledWith({ coachId: 'c2', permission: 'edit' })
})

test('non-admin coaches see no management trigger', () => {
  vi.spyOn(team, 'useTeam').mockReturnValue({ data: [{ coach_id: 'c1', relationship: 'head', permission: 'edit', coach: { name: 'Mara Whitlock', title: 'Head Coach', initials: 'MW' } }], isLoading: false } as any)
  wrap(<TeamPopover athleteId="a1" isAdmin={false} />)
  expect(screen.getByText('MW')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /manage coaching team/i })).not.toBeInTheDocument()
})
