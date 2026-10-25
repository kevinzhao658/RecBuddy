import { render, screen, fireEvent } from '@testing-library/react'
import { LinkRequests } from './LinkRequests'
import * as lr from '../../lib/queries/linkRequests'

const req = (over = {}) => ({ id: 'r1', kind: 'co_coach', coach_id: 'me', athlete_id: 'a1', relationship: 'assistant',
  requester_name: 'Dani Brooks', athlete_name: 'Maya Chen', created_at: '2026-10-24T10:00:00Z', ...over })

beforeEach(() => {
  vi.spyOn(lr, 'useRespondLinkRequest').mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
})

test('shows co-coach invites with Accept and Decline', () => {
  const respond = vi.fn()
  vi.spyOn(lr, 'useRespondLinkRequest').mockReturnValue({ mutate: respond, isPending: false } as any)
  vi.spyOn(lr, 'useMyLinkRequests').mockReturnValue({ data: [req(), req({ id: 'r2', kind: 'athlete' })] } as any)
  render(<LinkRequests />)
  expect(screen.getByText(/Dani Brooks invited you to coach Maya Chen/)).toBeInTheDocument()
  expect(screen.getAllByRole('button', { name: /accept/i })).toHaveLength(1) // athlete-side requests are for the app
  fireEvent.click(screen.getByRole('button', { name: /accept/i }))
  expect(respond).toHaveBeenCalledWith({ id: 'r1', accept: true })
  fireEvent.click(screen.getByRole('button', { name: /decline/i }))
  expect(respond).toHaveBeenCalledWith({ id: 'r1', accept: false })
})

test('renders nothing without invites', () => {
  vi.spyOn(lr, 'useMyLinkRequests').mockReturnValue({ data: [] } as any)
  const { container } = render(<LinkRequests />)
  expect(container).toBeEmptyDOMElement()
})
