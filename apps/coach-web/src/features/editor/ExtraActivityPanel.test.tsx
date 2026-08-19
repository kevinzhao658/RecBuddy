import { render, screen, fireEvent } from '@testing-library/react'
import { ExtraActivityPanel } from './ExtraActivityPanel'

const run = { id: 'x1', workout_id: null, athlete_id: 'a', dist: 5.2, pace: '9:00/mi',
  time: '46:48', hr: 152, feel: null, note: null, source: 'apple_health',
  source_id: 'hk1', recorded_at: '2026-09-08T14:00:00Z' } as any

test('shows the extra run’s metrics, including avg heart rate', () => {
  const onClose = vi.fn()
  render(<ExtraActivityPanel actual={run} onClose={onClose} />)
  expect(screen.getByText(/extra run/i)).toBeInTheDocument()
  expect(screen.getByText('Distance')).toBeInTheDocument()
  expect(screen.getByText(/5\.2 mi/)).toBeInTheDocument()
  expect(screen.getByText('Avg pace')).toBeInTheDocument()
  expect(screen.getByText('46:48')).toBeInTheDocument()
  expect(screen.getByText('Avg HR')).toBeInTheDocument()
  expect(screen.getByText('152')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /close/i }))
  expect(onClose).toHaveBeenCalled()
})

test('a ride hides the pace tile and omits HR when not recorded', () => {
  render(<ExtraActivityPanel actual={{ ...run, pace: null, hr: null }} onClose={() => {}} />)
  expect(screen.getByText(/extra ride/i)).toBeInTheDocument()
  expect(screen.queryByText('Avg pace')).toBeNull()
  expect(screen.queryByText('Avg HR')).toBeNull()
})
