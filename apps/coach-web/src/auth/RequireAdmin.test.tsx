import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { RequireAdmin } from './RequireAdmin'
import * as auth from './AuthProvider'

function renderAt(state: Partial<ReturnType<typeof auth.useAuth>>) {
  vi.spyOn(auth, 'useAuth').mockReturnValue({ session: null, role: null, isCoach: false, isAdmin: false, loading: false, ...state } as any)
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route path="/login" element={<div>login</div>} />
        <Route path="/coach" element={<div>coach</div>} />
        <Route path="/admin" element={<RequireAdmin><div>console</div></RequireAdmin>} />
      </Routes>
    </MemoryRouter>,
  )
}

test('admin sees the console', () => {
  renderAt({ session: {} as any, isAdmin: true })
  expect(screen.getByText('console')).toBeInTheDocument()
})
test('signed-in non-admin goes to the coach app', () => {
  renderAt({ session: {} as any, isCoach: true })
  expect(screen.getByText('coach')).toBeInTheDocument()
})
test('signed-out visitor goes to login', () => {
  renderAt({})
  expect(screen.getByText('login')).toBeInTheDocument()
})
