import { render, screen } from '@testing-library/react'
import { WeekStats } from './WeekStats'

const run = (dist: number, status = 'planned') =>
  ({ type: 'easy', dist, pace: '9:00/mi', est_minutes: null, dur: null, status }) as any

test('mileage bar shows the activated actual and the faded planned denominator', () => {
  render(<WeekStats week={[[run(5)], [], [], [], [], [], []]} />)
  expect(screen.getByText('Weekly mileage')).toBeInTheDocument()
  expect(screen.getByText('0.0')).toBeInTheDocument()        // actual, activated
  expect(screen.getByText(/\/ 5\.0 mi/)).toBeInTheDocument() // planned, faded
})

test('sums a day holding two workouts and counts done miles against plan', () => {
  // 3 mi done + 4 mi planned + 5 mi planned = 3 of 12 completed.
  render(<WeekStats week={[[run(3, 'done'), run(4)], [run(5)], [], [], [], [], []]} />)
  expect(screen.getByText('3.0')).toBeInTheDocument()
  expect(screen.getByText(/\/ 12\.0 mi/)).toBeInTheDocument()
})

test('tracks time on feet completed vs planned alongside mileage', () => {
  render(<WeekStats week={[[run(6, 'done')], [run(6)], [], [], [], [], []]} />)
  expect(screen.getByText('Time on feet')).toBeInTheDocument()
  // 6 mi @ 9:00/mi = 54 min each; one done -> 54m of 1h 48m.
  expect(screen.getByText('54m')).toBeInTheDocument()
  expect(screen.getByText(/\/ 1h 48m/)).toBeInTheDocument()
})
