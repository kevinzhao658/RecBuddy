import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RequireCoach } from './RequireCoach'
import * as auth from './AuthProvider'

function renderAt(state: any) {
  vi.spyOn(auth, 'useAuth').mockReturnValue(state)
  return render(
    <MemoryRouter initialEntries={['/coach']}>
      <Routes>
        <Route path="/login" element={<div>login</div>} />
        <Route path="/coach" element={<RequireCoach><div>dashboard</div></RequireCoach>} />
      </Routes>
    </MemoryRouter>,
  )
}

test('coach sees the dashboard', () => {
  renderAt({ session: {}, role: 'coach', isCoach: true, loading: false })
  expect(screen.getByText('dashboard')).toBeInTheDocument()
})
test('athlete-only account is redirected to login', () => {
  renderAt({ session: {}, role: 'athlete', isCoach: false, loading: false })
  expect(screen.getByText('login')).toBeInTheDocument()
})
test('dual-role athlete with coach flag sees the dashboard', () => {
  renderAt({ session: {}, role: 'athlete', isCoach: true, loading: false })
  expect(screen.getByText('dashboard')).toBeInTheDocument()
})
test('no session redirects to login', () => {
  renderAt({ session: null, role: null, isCoach: false, loading: false })
  expect(screen.getByText('login')).toBeInTheDocument()
})

import { RedirectIfCoach } from './RequireCoach'

function loginAt(state: any, from?: string) {
  vi.spyOn(auth, 'useAuth').mockReturnValue({ loading: false, ...state })
  return render(
    <MemoryRouter initialEntries={[{ pathname: '/login', state: from ? { from } : null }]}>
      <Routes>
        <Route path="/login" element={<RedirectIfCoach><div>login form</div></RedirectIfCoach>} />
        <Route path="/coach" element={<div>dashboard</div>} />
        <Route path="/admin/*" element={<div>admin console</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

test('admin signing in from an admin link returns to it', () => {
  loginAt({ session: {}, isCoach: true, isAdmin: true }, '/admin/reports?id=r1')
  expect(screen.getByText('admin console')).toBeInTheDocument()
})
test('coach without admin rights ignores an admin return path', () => {
  loginAt({ session: {}, isCoach: true, isAdmin: false }, '/admin/reports')
  expect(screen.getByText('dashboard')).toBeInTheDocument()
})
test('admin-only account lands in the console, not stuck on login', () => {
  loginAt({ session: {}, isCoach: false, isAdmin: true })
  expect(screen.getByText('admin console')).toBeInTheDocument()
})
test('signed-out visitor sees the login form', () => {
  loginAt({ session: null, isCoach: false, isAdmin: false })
  expect(screen.getByText('login form')).toBeInTheDocument()
})
