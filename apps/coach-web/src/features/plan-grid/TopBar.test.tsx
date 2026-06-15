import { render, screen } from '@testing-library/react'
import { TopBar } from './TopBar'

test('shows goal + week + computed weekly volume', () => {
  render(<TopBar athlete={{ name: 'Jordan', initials: 'JR' } as any}
    plan={{ goal_race: 'Riverside Half', goal_date: 'Aug 23', plan_week: 5, plan_weeks: 16, status: 'On track' } as any}
    week={[{ type: 'easy', dist: 5, pace: '9:00/mi', est_minutes: null, dur: null } as any, null, null, null, null, null, null]} />)
  expect(screen.getByText(/Riverside Half/)).toBeInTheDocument()
  expect(screen.getByText(/Week 5 of 16/)).toBeInTheDocument()
  expect(screen.getByText(/5\.0 mi/)).toBeInTheDocument() // weekly volume
})
