import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import * as authMod from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import ResetPasswordPage from './ResetPasswordPage'

function renderPage({ search = '', hash = '' } = {}) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search, hash },
    writable: true,
    configurable: true,
  })
  vi.spyOn(authMod, 'useAuth').mockReturnValue({ session: null, role: null, isCoach: false, loading: false })
  return render(<MemoryRouter><ResetPasswordPage /></MemoryRouter>)
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
  const verify = vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValue({ data: {}, error: null } as never)
  const update = vi.spyOn(supabase.auth, 'updateUser').mockResolvedValue({ data: {}, error: null } as never)
  const user = userEvent.setup()
  renderPage({ search: '?token_hash=pkce_abc&type=recovery' })

  expect(verify).not.toHaveBeenCalled()
  await user.type(screen.getByLabelText(/new password/i), 'newpass1')
  await user.click(screen.getByRole('button', { name: /update password/i }))

  expect(verify).toHaveBeenCalledWith({ token_hash: 'pkce_abc', type: 'recovery' })
  expect(update).toHaveBeenCalledWith({ password: 'newpass1' })
  expect(await screen.findByText(/password updated/i)).toBeInTheDocument()
})

test('shows the expired state when the token is rejected', async () => {
  vi.spyOn(supabase.auth, 'verifyOtp').mockResolvedValue({ data: {}, error: { message: 'Email link is invalid or has expired' } } as never)
  const update = vi.spyOn(supabase.auth, 'updateUser')
  const user = userEvent.setup()
  renderPage({ search: '?token_hash=used&type=recovery' })

  await user.type(screen.getByLabelText(/new password/i), 'newpass1')
  await user.click(screen.getByRole('button', { name: /update password/i }))

  expect(await screen.findByText(/link expired/i)).toBeInTheDocument()
  expect(screen.getByText('Email link is invalid or has expired')).toBeInTheDocument()
  expect(update).not.toHaveBeenCalled()
})
