import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import * as accountMod from '../lib/queries/account'
import LoginPage from './LoginPage'

afterEach(() => vi.restoreAllMocks())

async function requestReset(email = 'coach@example.com') {
  const user = userEvent.setup()
  render(<MemoryRouter><LoginPage /></MemoryRouter>)
  await user.click(screen.getByRole('button', { name: /forgot password/i }))
  await user.type(screen.getByLabelText(/email/i), email)
  await user.click(screen.getByRole('button', { name: /send reset link/i }))
  return user
}

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
  vi.spyOn(accountMod, 'emailHasAccount').mockResolvedValue(true)
  const send = vi.spyOn(supabase.auth, 'resetPasswordForEmail').mockResolvedValue({ data: {}, error: null } as never)
  const user = await requestReset()

  expect(await screen.findByText(/reset link sent to coach@example.com/i)).toBeInTheDocument()
  const resend = screen.getByRole('button', { name: /resend in \d+s/i })
  expect(resend).toBeDisabled()
  await user.click(resend)
  expect(send).toHaveBeenCalledTimes(1)
})

test('also locks the button when supabase rate-limits the request', async () => {
  vi.spyOn(accountMod, 'emailHasAccount').mockResolvedValue(true)
  vi.spyOn(supabase.auth, 'resetPasswordForEmail')
    .mockResolvedValue({ data: null, error: { status: 429, message: 'For security purposes, you can only request this after 42 seconds.' } } as never)
  await requestReset()

  expect(await screen.findByText(/only request this after 42 seconds/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /resend in \d+s/i })).toBeDisabled()
})

test('tells the user when no account uses that email, without sending', async () => {
  vi.spyOn(accountMod, 'emailHasAccount').mockResolvedValue(false)
  const send = vi.spyOn(supabase.auth, 'resetPasswordForEmail')
  await requestReset('nobody@example.com')

  expect(await screen.findByText('We couldn’t find an account with that email.')).toBeInTheDocument()
  expect(send).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: /send reset link/i })).toBeEnabled()
})

test('the reset screen pre-fills from, but never changes, the sign-in email', async () => {
  vi.spyOn(accountMod, 'emailHasAccount').mockResolvedValue(true)
  vi.spyOn(supabase.auth, 'resetPasswordForEmail').mockResolvedValue({ data: {}, error: null } as never)
  const user = userEvent.setup()
  render(<MemoryRouter><LoginPage /></MemoryRouter>)

  await user.type(screen.getByLabelText(/email/i), 'typed@example.com')
  await user.click(screen.getByRole('button', { name: /forgot password/i }))
  const resetField = screen.getByLabelText(/email/i)
  expect(resetField).toHaveValue('typed@example.com')
  await user.clear(resetField)
  await user.type(resetField, 'someone@example.com')
  await user.click(screen.getByRole('button', { name: /send reset link/i }))
  await screen.findByText(/reset link sent to someone@example.com/i)

  await user.click(screen.getByRole('button', { name: /back to sign in/i }))
  expect(screen.getByLabelText(/email/i)).toHaveValue('typed@example.com')
})

test('a blank sign-in email stays blank after sending a reset', async () => {
  vi.spyOn(accountMod, 'emailHasAccount').mockResolvedValue(true)
  vi.spyOn(supabase.auth, 'resetPasswordForEmail').mockResolvedValue({ data: {}, error: null } as never)
  const user = await requestReset('someone@example.com')
  await screen.findByText(/reset link sent to someone@example.com/i)

  await user.click(screen.getByRole('button', { name: /back to sign in/i }))
  expect(screen.getByLabelText(/email/i)).toHaveValue('')
  expect(screen.getByRole('button', { name: /log in/i })).toBeEnabled()
})

test('still sends when the account check is unavailable', async () => {
  vi.spyOn(accountMod, 'emailHasAccount').mockRejectedValue(new Error('function not found'))
  const send = vi.spyOn(supabase.auth, 'resetPasswordForEmail').mockResolvedValue({ data: {}, error: null } as never)
  await requestReset()

  expect(await screen.findByText(/reset link sent/i)).toBeInTheDocument()
  expect(send).toHaveBeenCalledTimes(1)
})
