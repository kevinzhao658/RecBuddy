import { render, screen, fireEvent } from '@testing-library/react'
import { MonthGrid } from './MonthGrid'

const byDate = {
  '2026-06-03': [{ date: '2026-06-03', type: 'speed', title: '5 × 800m', dist: 6, pace: '7:30/mi', status: 'done' }] as any,
}

test('renders weekday + week-mileage headers, a day with mileage/status, and picks a day', () => {
  const onPick = vi.fn()
  render(<MonthGrid anchor="2026-06-01" byDate={byDate} selectedDate={null} onPick={onPick} />)
  expect(screen.getByText('Mon')).toBeInTheDocument()
  expect(screen.getByText(/weekly volume/i)).toBeInTheDocument()
  // The day cell shows a status label (not the workout title); 14% etc. comes
  // from the week-mileage summary. Click the "Done" day → onPick with its date.
  fireEvent.click(screen.getByRole('button', { name: /done/i }))
  expect(onPick).toHaveBeenCalledWith('2026-06-03')
})

test('shows one icon per workout up to three, then a +N chip', () => {
  const mk = (title: string, type = 'easy') =>
    ({ id: title, date: '2026-06-03', type, title, dist: 3, pace: '9:00/mi', status: 'planned' })
  // Four workouts → three icons + "+1".
  const four = { '2026-06-03': [mk('W1'), mk('W2', 'speed'), mk('W3', 'tempo'), mk('W4', 'long')] as any }
  const { rerender } = render(<MonthGrid anchor="2026-06-01" byDate={four} selectedDate={null} onPick={vi.fn()} />)
  expect(screen.getByText('+1')).toBeInTheDocument()

  // Two workouts → just the icons, no overflow chip.
  const two = { '2026-06-03': [mk('W1'), mk('W2', 'speed')] as any }
  rerender(<MonthGrid anchor="2026-06-01" byDate={two} selectedDate={null} onPick={vi.fn()} />)
  expect(screen.queryByText(/^\+\d/)).toBeNull()
})
