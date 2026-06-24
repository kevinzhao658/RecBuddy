import { render, screen, fireEvent } from '@testing-library/react'
import { DayCard } from './DayCard'

const w = { id: 'w1', title: '5 × 800m', dist: 6, pace: '7:30/mi', type: 'speed', status: 'today' } as any

test('renders workout summary and fires onClick', () => {
  const onClick = vi.fn()
  render(<DayCard date="2026-09-08" dow="Tue" workout={w} selected={false} onClick={onClick} onCopy={() => {}} />)
  expect(screen.getByText('5 × 800m')).toBeInTheDocument()
  expect(screen.getByText('6 mi · 7:30/mi')).toBeInTheDocument()
  fireEvent.click(screen.getByText('5 × 800m'))
  expect(onClick).toHaveBeenCalled()
})

test('empty day shows Add', () => {
  render(<DayCard date="2026-09-09" dow="Wed" workout={null} selected={false} onClick={() => {}} onCopy={() => {}} />)
  expect(screen.getByText(/add/i)).toBeInTheDocument()
})
