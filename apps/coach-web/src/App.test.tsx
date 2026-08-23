import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import App from './App'

// The legal pages must render logged-out (App Review has no coach account),
// so App is mounted with no auth session at these paths.
test.each([
  ['/privacy', 'Privacy Policy'],
  ['/terms', 'Terms & Conditions'],
  ['/support', 'Support'],
])('%s renders publicly', (path, heading) => {
  render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>)
  expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
})
