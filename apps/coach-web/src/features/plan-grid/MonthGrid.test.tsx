import { render, screen, fireEvent } from '@testing-library/react'
import { MonthGrid } from './MonthGrid'

const byDate = {
  '2026-06-03': { date: '2026-06-03', type: 'speed', title: '5 × 800m', status: 'planned' } as any,
}

test('renders weekday headers and a workout chip, and picks a day', () => {
  const onPick = vi.fn()
  render(<MonthGrid anchor="2026-06-01" byDate={byDate} selectedDate={null} onPick={onPick} />)
  expect(screen.getByText('Mon')).toBeInTheDocument()
  expect(screen.getByText('5 × 800m')).toBeInTheDocument()
  // Clicking the workout's day cell calls onPick with that ISO date
  fireEvent.click(screen.getByText('5 × 800m'))
  expect(onPick).toHaveBeenCalledWith('2026-06-03')
})
