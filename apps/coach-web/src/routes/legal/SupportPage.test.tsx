import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import SupportPage from './SupportPage'

test('renders contact email and common questions', () => {
  render(<MemoryRouter><SupportPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1, name: 'Support' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'support@recbuddy.app' })).toHaveAttribute('href', 'mailto:support@recbuddy.app')
  expect(screen.getByText(/2–3 business days/)).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Common questions' })).toBeInTheDocument()
})
