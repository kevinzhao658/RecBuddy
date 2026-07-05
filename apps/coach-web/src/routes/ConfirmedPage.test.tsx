import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import ConfirmedPage from './ConfirmedPage'

function renderPage(hash = '') {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, hash },
    writable: true,
    configurable: true,
  })
  return render(<MemoryRouter><ConfirmedPage /></MemoryRouter>)
}

afterEach(() => {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, hash: '' },
    writable: true,
    configurable: true,
  })
})

test('shows success state when there is no error in the hash', () => {
  renderPage('')
  expect(screen.getByText(/email confirmed/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /open the recbuddy app/i })).toHaveAttribute(
    'href',
    'recbuddy://confirmed',
  )
  expect(screen.getByText(/on your phone, this opens the app directly/i)).toBeInTheDocument()
})

test('shows error state when supabase appends an error fragment', () => {
  renderPage('#error=access_denied&error_description=Email+link+is+invalid+or+has+expired')
  expect(screen.getByText(/this link is invalid or has expired/i)).toBeInTheDocument()
  expect(screen.getByText(/email link is invalid or has expired/i)).toBeInTheDocument()
  expect(screen.getByText(/request a new confirmation email/i)).toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /open the recbuddy app/i })).not.toBeInTheDocument()
})
