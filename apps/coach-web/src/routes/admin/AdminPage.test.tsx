import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AdminPage from './AdminPage'
import * as reports from '../../features/admin/ReportsQueue'
import * as users from '../../features/admin/UserLookup'
import * as audit from '../../features/admin/AuditLog'

function Where() { return <div data-testid="path">{useLocation().pathname}</div> }

beforeEach(() => {
  vi.spyOn(reports, 'ReportsQueue').mockReturnValue(<div>reports section</div>)
  vi.spyOn(users, 'UserLookup').mockReturnValue(<div>users section</div>)
  vi.spyOn(audit, 'AuditLog').mockReturnValue(<div>audit section</div>)
})

const renderAt = (path: string) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes><Route path="/admin/*" element={<><AdminPage /><Where /></>} /></Routes>
  </MemoryRouter>,
)

// Regression: relative tab links inside the /admin/* splat resolved against
// the current section (/admin/users/reports…) and the catch-all redirect
// appended "reports" forever — a render loop and a blank screen.
test('section tabs navigate between sections from anywhere', () => {
  renderAt('/admin/users')
  fireEvent.click(screen.getByRole('link', { name: 'Reports' }))
  expect(screen.getByTestId('path')).toHaveTextContent(/^\/admin\/reports$/)
  expect(screen.getByText('reports section')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('link', { name: 'Audit log' }))
  expect(screen.getByTestId('path')).toHaveTextContent(/^\/admin\/audit$/)
  fireEvent.click(screen.getByRole('link', { name: 'Users' }))
  expect(screen.getByText('users section')).toBeInTheDocument()
})

test('unknown admin paths redirect once to Reports', () => {
  renderAt('/admin/users/nope')
  expect(screen.getByTestId('path')).toHaveTextContent(/^\/admin\/reports$/)
})
