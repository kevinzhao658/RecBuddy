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
  renderAt({ session: {}, role: 'coach', loading: false })
  expect(screen.getByText('dashboard')).toBeInTheDocument()
})
test('athlete is redirected to login', () => {
  renderAt({ session: {}, role: 'athlete', loading: false })
  expect(screen.getByText('login')).toBeInTheDocument()
})
test('no session redirects to login', () => {
  renderAt({ session: null, role: null, loading: false })
  expect(screen.getByText('login')).toBeInTheDocument()
})
