import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LoginPage from './LoginPage'

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
