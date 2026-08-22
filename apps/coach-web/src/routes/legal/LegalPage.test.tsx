import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LegalPage, LegalSection } from './LegalPage'

test('renders title, updated line, home link, section, and footer', () => {
  render(
    <MemoryRouter>
      <LegalPage title="Test Page" updated="August 2026">
        <LegalSection title="First Section"><p>Body text</p></LegalSection>
      </LegalPage>
    </MemoryRouter>,
  )
  expect(screen.getByRole('heading', { level: 1, name: 'Test Page' })).toBeInTheDocument()
  expect(screen.getByText(/last updated august 2026/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /recbuddy/i })).toHaveAttribute('href', '/')
  expect(screen.getByRole('heading', { level: 2, name: 'First Section' })).toBeInTheDocument()
  expect(screen.getByText('Body text')).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy')
})
