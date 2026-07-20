import { render, screen } from '@testing-library/react'
import { WeekStats } from './WeekStats'

const run = (dist: number) => ({ type: 'easy', dist, pace: '9:00/mi', est_minutes: null, dur: null, status: 'planned' }) as any

test('computes weekly volume from the present workouts', () => {
  render(<WeekStats week={[[run(5)], [], [], [], [], [], []]} />)
  expect(screen.getByText(/5\.0 mi/)).toBeInTheDocument()
})

test('sums a day holding two workouts into the weekly volume', () => {
  render(<WeekStats week={[[run(3), run(4)], [run(5)], [], [], [], [], []]} />)
  expect(screen.getByText(/12\.0 mi/)).toBeInTheDocument()
  expect(screen.getByText('0/3')).toBeInTheDocument() // completion counts every workout
})
