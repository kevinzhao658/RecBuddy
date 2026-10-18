import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { UserDetail } from './UserDetail'
import * as admin from '../../lib/queries/admin'

const detail: admin.AdminUserDetail = {
  profile: { id: 'a1', name: 'Maya Chen', email: 'maya@x.app', is_coach: false, is_athlete: true, is_admin: false, suspended_at: null, suspended_reason: null },
  coaches: [
    { id: 'c1', name: 'Dani Brooks', email: null, relationship: 'head', permission: 'admin' },
    { id: 'c2', name: 'Marcus Hale', email: null, relationship: 'assistant', permission: 'edit' },
  ],
  athletes: [],
  blocked: [{ id: 'c3', name: 'Old Coach', at: new Date().toISOString() }],
  blocked_by: [],
  reports_against: [],
  reports_by: [{ id: 'r1', reason: 'hate', status: 'open', created_at: new Date().toISOString() }],
  actions: [{ action: 'unsuspend', note: 'appeal ok', admin: 'Kevin', created_at: new Date().toISOString() }],
}

let removeLink: ReturnType<typeof vi.fn>, setHead: ReturnType<typeof vi.fn>, act: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.spyOn(admin, 'useAdminUser').mockReturnValue({ data: detail, isLoading: false, error: null } as any)
  removeLink = vi.fn().mockResolvedValue(undefined)
  setHead = vi.fn().mockResolvedValue(undefined)
  act = vi.fn().mockResolvedValue(undefined)
  vi.spyOn(admin, 'useRemoveLink').mockReturnValue({ mutateAsync: removeLink } as any)
  vi.spyOn(admin, 'useSetHead').mockReturnValue({ mutateAsync: setHead } as any)
  vi.spyOn(admin, 'useAdminAction').mockReturnValue({ mutateAsync: act } as any)
})

const renderIt = () => render(<MemoryRouter><UserDetail userId="a1" /></MemoryRouter>)

test('shows teams, blocks, reports and history', () => {
  renderIt()
  expect(screen.getByRole('heading', { name: 'Maya Chen' })).toBeInTheDocument()
  expect(screen.getByText('Dani Brooks')).toBeInTheDocument()
  expect(screen.getByText('Old Coach')).toBeInTheDocument()
  expect(screen.getByText('Hate speech or slurs')).toBeInTheDocument()
  expect(screen.getByText(/appeal ok/)).toBeInTheDocument()
  // Head coach can't be "made head" again
  expect(screen.queryByRole('button', { name: 'Make Dani Brooks head coach' })).not.toBeInTheDocument()
})

test('dispute tools: make head and remove link, each with a note', async () => {
  renderIt()
  fireEvent.click(screen.getByRole('button', { name: 'Make Marcus Hale head coach' }))
  fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'athlete request' } })
  fireEvent.click(screen.getByRole('button', { name: 'Make head coach' }))
  await waitFor(() => expect(setHead).toHaveBeenCalledWith({ coachId: 'c2', athleteId: 'a1', note: 'athlete request' }))

  fireEvent.click(screen.getByRole('button', { name: 'Remove Dani Brooks from Maya Chen' }))
  fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'dispute' } })
  fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
  await waitFor(() => expect(removeLink).toHaveBeenCalledWith({ coachId: 'c1', athleteId: 'a1', note: 'dispute' }))
})

test('suspend from the user page', async () => {
  renderIt()
  fireEvent.click(screen.getByRole('button', { name: 'Suspend' }))
  fireEvent.change(screen.getByLabelText(/Note/), { target: { value: 'abuse' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Suspend' }).at(-1)!)
  await waitFor(() => expect(act).toHaveBeenCalledWith({ action: 'suspend', user_id: 'a1', note: 'abuse' }))
})
