import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Footer } from './Footer'

test('renders copyright and the three legal links', () => {
  render(<MemoryRouter><Footer /></MemoryRouter>)
  expect(screen.getByText('© 2026 RecBuddy')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
  expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
  expect(screen.getByRole('link', { name: 'Support' })).toHaveAttribute('href', '/support')
})
