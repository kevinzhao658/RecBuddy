import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PrivacyPage from './PrivacyPage'

test('renders the policy with the HealthKit disclosure and contact email', () => {
  render(<MemoryRouter><PrivacyPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Apple Health (HealthKit)' })).toBeInTheDocument()
  expect(screen.getByText(/read-only/)).toBeInTheDocument()
  expect(screen.getAllByText(/support@recbuddy\.app/).length).toBeGreaterThanOrEqual(2)
  expect(screen.getByText(/last updated july 31, 2026/i)).toBeInTheDocument()
  // Guards that ALL markdown sections were ported, not just the ones shown in the plan:
  // Who we are, Information we collect, Apple Health, How we use, How shared, Retention,
  // Choices/rights, Security, Children's, International, Changes, Contact = 12 h2s.
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(12)
  expect(screen.getByRole('heading', { level: 2, name: /children/i })).toBeInTheDocument()
})
