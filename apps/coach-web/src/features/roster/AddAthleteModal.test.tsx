import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { AddAthleteModal } from './AddAthleteModal'
import * as invites from '../../lib/queries/invites'

function wrap(ui: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

test('reopening after generating a code starts fresh (no stale code)', () => {
  // mutate immediately invokes onSuccess with a fake code
  vi.spyOn(invites, 'useCreateInvite').mockReturnValue({
    mutate: (name: string, opts: any) => opts.onSuccess('CODE1234'),
    isPending: false,
  } as any)

  const { rerender } = wrap(<AddAthleteModal open={true} onClose={() => {}} />)
  fireEvent.change(screen.getByLabelText(/athlete name/i), { target: { value: 'Pat' } })
  fireEvent.click(screen.getByRole('button', { name: /generate invite code/i }))
  expect(screen.getByText('CODE1234')).toBeInTheDocument() // code shown

  // close (e.g. via backdrop) then reopen
  rerender(<QueryClientProvider client={new QueryClient()}><AddAthleteModal open={false} onClose={() => {}} /></QueryClientProvider>)
  rerender(<QueryClientProvider client={new QueryClient()}><AddAthleteModal open={true} onClose={() => {}} /></QueryClientProvider>)

  expect(screen.queryByText('CODE1234')).not.toBeInTheDocument() // stale code gone
  expect(screen.getByLabelText(/athlete name/i)).toBeInTheDocument() // fresh input
})
