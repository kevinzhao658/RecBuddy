import { render, screen } from '@testing-library/react'
import { TopBar } from './TopBar'

test('shows the athlete identity: name, goal race, and week', () => {
  render(<TopBar athlete={{ name: 'Jordan', initials: 'JR' } as any}
    plan={{ goal_race: 'Riverside Half', goal_date: 'Aug 23', plan_week: 5, plan_weeks: 16, status: 'On track' } as any} />)
  expect(screen.getByText('Jordan')).toBeInTheDocument()
  expect(screen.getByText(/Riverside Half/)).toBeInTheDocument()
  expect(screen.getByText(/Week 5 of 16/)).toBeInTheDocument()
})
