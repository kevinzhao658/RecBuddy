import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import TermsPage from './TermsPage'

test('renders all seventeen sections with the support contact', () => {
  render(<MemoryRouter><TermsPage /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1, name: 'Terms & Conditions' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: '1. Acceptance of Terms' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: '2. Eligibility' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: '4. Role of RecBuddy; Coaches' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: '12. Disclaimer of Warranties' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: '14. Governing Law & Venue' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 2, name: '17. Contact' })).toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(17)
  expect(screen.getByText(/at least 13 years old/)).toBeInTheDocument()
  expect(screen.getByText(/State of New York/)).toBeInTheDocument()
  expect(screen.getByText(/zero tolerance for objectionable content/)).toBeInTheDocument()
  expect(screen.getAllByText(/support@recbuddy\.app/).length).toBeGreaterThanOrEqual(2)
  expect(screen.queryByText(/kevin@recbuddy\.app/)).not.toBeInTheDocument()
  expect(screen.getByText(/last updated october 2026/i)).toBeInTheDocument()
  expect(screen.queryByText(/stops them from messaging you or seeing your chat/)).not.toBeInTheDocument()
  expect(screen.getByText(/in a group chat you both belong to, you stop seeing their messages/)).toBeInTheDocument()
  expect(screen.getByText(/messages and reactions you send in conversations, including group chats/)).toBeInTheDocument()
})

test('Your Content covers videos', () => {
  render(<MemoryRouter><TermsPage /></MemoryRouter>)
  expect(screen.getByText(/messages, notes, photos, videos, logged workouts/)).toBeInTheDocument()
})
