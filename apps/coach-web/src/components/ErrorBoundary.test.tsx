import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('kaboom')
}

test('renders children when there is no error', () => {
  render(<ErrorBoundary><p>all good</p></ErrorBoundary>)
  expect(screen.getByText('all good')).toBeInTheDocument()
})

test('shows a readable fallback (with the message) when a child throws', () => {
  const spy = vi.spyOn(console, 'error').mockImplementation(() => {}) // silence expected React error log
  render(<ErrorBoundary><Boom /></ErrorBoundary>)
  expect(screen.getByText(/something went wrong/i)).toBeInTheDocument()
  expect(screen.getByText(/kaboom/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /reload/i })).toBeInTheDocument()
  spy.mockRestore()
})
