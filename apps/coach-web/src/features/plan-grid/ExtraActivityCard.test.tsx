import { render, screen } from '@testing-library/react'
import { ExtraActivityCard } from './ExtraActivityCard'

const base = { id: 'x1', workout_id: null, athlete_id: 'a', dist: 5.2, pace: '9:00/mi',
  time: '46:48', hr: null, feel: null, note: null, source: 'apple_health',
  source_id: 'hk1', recorded_at: '2026-08-17T14:00:00Z' } as any

test('renders an extra RUN with distance and time', () => {
  render(<ExtraActivityCard actual={base} />)
  expect(screen.getByText(/extra run/i)).toBeInTheDocument()
  expect(screen.getByText(/5\.2 mi · 46:48/)).toBeInTheDocument()
})

test('null pace renders as an extra RIDE', () => {
  render(<ExtraActivityCard actual={{ ...base, pace: null }} />)
  expect(screen.getByText(/extra ride/i)).toBeInTheDocument()
})
