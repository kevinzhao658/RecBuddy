import { render, screen } from '@testing-library/react'
import { WeekStats } from './WeekStats'

test('computes weekly volume from the present workouts', () => {
  render(<WeekStats week={[{ type: 'easy', dist: 5, pace: '9:00/mi', est_minutes: null, dur: null } as any, null, null, null, null, null, null]} />)
  expect(screen.getByText(/5\.0 mi/)).toBeInTheDocument()
})
