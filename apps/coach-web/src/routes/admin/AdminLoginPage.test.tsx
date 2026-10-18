import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminLoginPage from './AdminLoginPage'
import * as auth from '../../auth/AuthProvider'
import { supabase } from '../../lib/supabase'

function mockProfile(p: { is_admin: boolean; suspended_at: string | null } | null) {
  vi.spyOn(supabase, 'from').mockReturnValue({
    select: () => ({ eq: () => ({ single: async () => ({ data: p }) }) }),
  } as any)
}

function renderLogin(state: Partial<ReturnType<typeof auth.useAuth>> = {}, from?: string) {
  vi.spyOn(auth, 'useAuth').mockReturnValue({ session: null, role: null, isCoach: false, isAdmin: false, loading: false, ...state } as any)
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/admin/login', state: from ? { from } : null }]}>
      <Routes>
        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route path="/admin/reports" element={<div>reports</div>} />
        <Route path="/admin/users" element={<div>users</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

const fill = () => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@x.app' } })
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'pw' } })
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
}

test('its own screen: no sign-up or Google, links back to coach sign-in', () => {
  renderLogin()
  expect(screen.getByRole('heading', { name: 'Sign in to the admin console' })).toBeInTheDocument()
  expect(screen.queryByText(/Google/)).not.toBeInTheDocument()
  expect(screen.queryByText(/Create/)).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Coach sign-in' })).toHaveAttribute('href', '/login')
})

test('an admin signs in and returns to the page they came from', async () => {
  vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({ data: { user: { id: 'u1' } }, error: null } as any)
  mockProfile({ is_admin: true, suspended_at: null })
  renderLogin({}, '/admin/users')
  fill()
  expect(await screen.findByText('users')).toBeInTheDocument()
})

test('a non-admin is refused and signed back out', async () => {
  vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({ data: { user: { id: 'u1' } }, error: null } as any)
  const out = vi.spyOn(supabase.auth, 'signOut').mockResolvedValue({ error: null } as any)
  mockProfile({ is_admin: false, suspended_at: null })
  renderLogin()
  fill()
  expect(await screen.findByRole('alert')).toHaveTextContent("doesn't have admin access")
  await waitFor(() => expect(out).toHaveBeenCalled())
})

test('wrong password shows the error', async () => {
  vi.spyOn(supabase.auth, 'signInWithPassword').mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login credentials' } } as any)
  renderLogin()
  fill()
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid login credentials')
})

test('an already signed-in admin skips straight to the console', () => {
  renderLogin({ session: {} as any, isAdmin: true })
  expect(screen.getByText('reports')).toBeInTheDocument()
})
