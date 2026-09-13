import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import LoginPage from './LoginPage'

afterEach(() => vi.restoreAllMocks())

test('renders the login form', () => {
  render(<MemoryRouter><LoginPage /></MemoryRouter>)
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
})

test('renders the legal footer', () => {
  render(<MemoryRouter><LoginPage /></MemoryRouter>)
  expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
  expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute('href', '/support')
})

test('locks the reset button after sending so repeat clicks send nothing', async () => {
  const send = vi.spyOn(supabase.auth, 'resetPasswordForEmail').mockResolvedValue({ data: {}, error: null } as never)
  const user = userEvent.setup()
  render(<MemoryRouter><LoginPage /></MemoryRouter>)

  await user.click(screen.getByRole('button', { name: /forgot password/i }))
  await user.type(screen.getByLabelText(/email/i), 'coach@example.com')
  await user.click(screen.getByRole('button', { name: /send reset link/i }))

  expect(await screen.findByText(/reset link sent to coach@example.com/i)).toBeInTheDocument()
  const resend = screen.getByRole('button', { name: /resend in \d+s/i })
  expect(resend).toBeDisabled()
  await user.click(resend)
  expect(send).toHaveBeenCalledTimes(1)
})

test('also locks the button when supabase rate-limits the request', async () => {
  vi.spyOn(supabase.auth, 'resetPasswordForEmail')
    .mockResolvedValue({ data: null, error: { status: 429, message: 'For security purposes, you can only request this after 42 seconds.' } } as never)
  const user = userEvent.setup()
  render(<MemoryRouter><LoginPage /></MemoryRouter>)

  await user.click(screen.getByRole('button', { name: /forgot password/i }))
  await user.type(screen.getByLabelText(/email/i), 'coach@example.com')
  await user.click(screen.getByRole('button', { name: /send reset link/i }))

  expect(await screen.findByText(/only request this after 42 seconds/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /resend in \d+s/i })).toBeDisabled()
})
