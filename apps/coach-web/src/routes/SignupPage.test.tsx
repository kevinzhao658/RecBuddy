import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SignupPage from './SignupPage'

test('renders signup with coaching title chips', () => {
  render(<MemoryRouter><SignupPage /></MemoryRouter>)
  expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /head coach/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument()
})
