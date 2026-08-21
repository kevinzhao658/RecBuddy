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

test('a declared swim titles as Extra swim', () => {
  render(<ExtraActivityPanel actual={{ ...run, pace: null, activity: 'swim' }} onClose={() => {}} />)
  expect(screen.getByText(/extra swim/i)).toBeInTheDocument()
})

test('a ride reads in avg speed and power; no run pace tile', () => {
  render(<ExtraActivityPanel
    actual={{ ...run, dist: 15.3, time: '52:00', pace: null, activity: 'ride', avg_watts: 210 }}
    onClose={() => {}} />)
  expect(screen.getByText('Avg speed')).toBeInTheDocument()
  expect(screen.getByText('17.7 mph')).toBeInTheDocument()
  expect(screen.getByText('Avg power')).toBeInTheDocument()
  expect(screen.getByText('210 W')).toBeInTheDocument()
  expect(screen.queryByText('Avg pace')).toBeNull()
})

test('a swim reads in meters and /100m pace', () => {
  render(<ExtraActivityPanel
    actual={{ ...run, dist: 1500 / 1609.344, time: '26:15', pace: null, activity: 'swim' }}
    onClose={() => {}} />)
  expect(screen.getByText('1,500 m')).toBeInTheDocument()
  expect(screen.getByText('Pace /100m')).toBeInTheDocument()
  expect(screen.getByText('1:45')).toBeInTheDocument()
})
