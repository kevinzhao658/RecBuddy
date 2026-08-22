import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TermsPage from './TermsPage'

test('renders all ten sections with the support contact', () => {
  render(<MemoryRouter><TermsPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1, name: 'Terms & Conditions' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: '1. Acceptance of Terms' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: '10. Contact' })).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(10)
  expect(screen.getAllByText(/support@recbuddy\.app/).length).toBeGreaterThanOrEqual(2)
  expect(screen.queryByText(/kevin@recbuddy\.app/)).not.toBeInTheDocument()
})
