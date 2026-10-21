import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PrivacyPage from './PrivacyPage'

test('renders the policy with the HealthKit disclosure and contact email', () => {
  render(<MemoryRouter><PrivacyPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Apple Health (HealthKit)' })).toBeInTheDocument()
  expect(screen.getAllByText(/read-only/).length).toBeGreaterThan(0) // HealthKit (and conversations) wording
  expect(screen.getAllByText(/support@recbuddy\.app/).length).toBeGreaterThanOrEqual(2)
  expect(screen.getByText(/last updated october 21, 2026/i)).toBeInTheDocument()
  expect(screen.getByText(/reactions, and replies in your conversations/i)).toBeInTheDocument()
  expect(screen.getByText(/A conversation is visible only to its members/)).toBeInTheDocument()
  expect(screen.getByText(/Let my coach.s other athletes find me/)).toBeInTheDocument()
  expect(screen.getByText(/photos and images you choose to share in chat/i)).toBeInTheDocument()
  expect(screen.getByText(/reports you submit about a message or user/i)).toBeInTheDocument()
  // Guards that ALL markdown sections were ported, not just the ones shown in the plan:
  // Who we are, Information we collect, Apple Health, How we use, How shared, Retention,
  // Choices/rights, Security, Children's, International, Changes, Contact = 12 h2s.
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(12)
  expect(screen.getByRole('heading', { level: 2, name: /children/i })).toBeInTheDocument()
})
