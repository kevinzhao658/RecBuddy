import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import * as authMod from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import ResetPasswordPage from './ResetPasswordPage'

function renderPage({ search = '', hash = '', isCoach = false } = {}) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search, hash },
    writable: true,
    configurable: true,
  })
  vi.spyOn(authMod, 'useAuth').mockReturnValue({ session: null, role: null, isCoach, loading: false })
  return render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>)
}

async function submitNewPassword() {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText(/new password/i), 'newpass1')
  await user.click(screen.getByRole('button', { name: /update password/i }))
}

function mockSuccessfulReset() {
  const verify = vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValue({ data: {}, error: null } as never)
  const update = vi.spyOn(supabase.auth, 'updateUser').mockResolvedValue({ data: {}, error: null } as never)
  return { verify, update }
}

afterEach(() => {
  vi.restoreAllMocks()
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search: '', hash: '' },
    writable: true,
    configurable: true,
  })
})

test('shows the expired state without a session or token', () => {
  renderPage()
  expect(screen.getByText(/link expired/i)).toBeInTheDocument()
  expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument()
})

test('surfaces the error supabase appends to the link', () => {
  renderPage({ hash: '#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired' })
  expect(screen.getByText(/link expired/i)).toBeInTheDocument()
  expect(screen.getByText('Email link is invalid or has expired')).toBeInTheDocument()
})

test('verifies a token-hash link on submit, then updates the password', async () => {
  const { verify, update } = mockSuccessfulReset()
  renderPage({ search: '?token_hash=pkce_abc&type=recovery' })

  expect(verify).not.toHaveBeenCalled()
  await submitNewPassword()

  expect(verify).toHaveBeenCalledWith({ token_hash: 'pkce_abc', type: 'recovery' })
  expect(update).toHaveBeenCalledWith({ password: 'newpass1' })
})

test('after the update, points the user back to the app instead of the coach dashboard', async () => {
  mockSuccessfulReset()
  renderPage({ search: '?token_hash=pkce_abc&type=recovery' })
  await submitNewPassword()

  expect(await screen.findByText(/you’re all set/i)).toBeInTheDocument()
  expect(screen.getByText(/you can close this window now/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /open the recbuddy app/i })).toHaveAttribute('href', 'recbuddy://')
  expect(screen.queryByRole('link', { name: /coach dashboard/i })).not.toBeInTheDocument()
})

test('offers coaches a link to their dashboard', async () => {
  mockSuccessfulReset()
  renderPage({ search: '?token_hash=pkce_abc&type=recovery', isCoach: true })
  await submitNewPassword()

  expect(await screen.findByRole('link', { name: /go to your coach dashboard/i })).toHaveAttribute('href', '/coach')
})

test('shows the expired state when the token is rejected', async () => {
  vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValue({ data: {}, error: { message: 'Email link is invalid or has expired' } } as never)
  const update = vi.spyOn(supabase.auth, 'updateUser')
  renderPage({ search: '?token_hash=used&type=recovery' })
  await submitNewPassword()

  expect(await screen.findByText(/link expired/i)).toBeInTheDocument()
  expect(screen.getByText('Email link is invalid or has expired')).toBeInTheDocument()
  expect(update).not.toHaveBeenCalled()
})
