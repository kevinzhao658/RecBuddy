import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import PrivacyPage from './PrivacyPage'

test('renders the policy with the HealthKit disclosure and contact email', () => {
  render(<MemoryRouter><PrivacyPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: 'Apple Health (HealthKit)' })).toBeInTheDocument()
  expect(screen.getAllByText(/read-only/).length).toBeGreaterThan(0) // HealthKit (and conversations) wording
  expect(screen.getAllByText(/support@recbuddy\.app/).length).toBeGreaterThanOrEqual(2)
  expect(screen.getByText(/last updated october 25, 2026/i)).toBeInTheDocument()
  expect(screen.getByText(/reactions, and replies in your conversations/i)).toBeInTheDocument()
  expect(screen.getByText(/A conversation is visible only to its members/)).toBeInTheDocument()
  expect(screen.getByText(/Let my coach.s other athletes find me/)).toBeInTheDocument()
  expect(screen.getByText(/photos, videos and images you choose to share in chat/i)).toBeInTheDocument()
  expect(screen.getByText(/reports you submit about a message or user/i)).toBeInTheDocument()
  // Blocking in a shared group hides their messages from you, not yours from them.
  expect(screen.queryByText(/can no longer see your chat/)).not.toBeInTheDocument()
  expect(screen.getByText(/they can still see what you post there unless you leave the group/)).toBeInTheDocument()
  expect(screen.getByText(/Settings → Coaches in the iPhone app, Settings → Blocked on the web/)).toBeInTheDocument()
  // Guards that ALL markdown sections were ported, not just the ones shown in the plan:
  // Who we are, Information we collect, Apple Health, How we use, How shared, Retention,
  // Choices/rights, Security, Children's, International, Changes, Contact = 12 h2s.
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(12)
  expect(screen.getByRole('heading', { level: 2, name: /children/i })).toBeInTheDocument()
})

test('says a coach connection needs your acceptance', () => {
  render(<MemoryRouter><PrivacyPage /></MemoryRouter>)
  expect(screen.getByText(/nothing is shared until you accept/i)).toBeInTheDocument()
})

test('says chat videos leave our servers after 7 days', () => {
  render(<MemoryRouter><PrivacyPage /></MemoryRouter>)
  expect(screen.getByText(/deleted from our servers 7 days after they.re sent/)).toBeInTheDocument()
  expect(screen.getByText(/Photos, videos and images you choose to share in chat/)).toBeInTheDocument()
})
