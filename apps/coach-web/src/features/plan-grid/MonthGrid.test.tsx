import { render, screen, fireEvent } from '@testing-library/react'
import { MonthGrid } from './MonthGrid'

const byDate = {
  '2026-06-03': { date: '2026-06-03', type: 'speed', title: '5 × 800m', dist: 6, pace: '7:30/mi', status: 'done' } as any,
}

test('renders weekday + week-mileage headers, a day with mileage/status, and picks a day', () => {
  const onPick = vi.fn()
  render(<MonthGrid anchor="2026-06-01" byDate={byDate} selectedDate={null} onPick={onPick} />)
  expect(screen.getByText('Mon')).toBeInTheDocument()
  expect(screen.getByText(/week mileage/i)).toBeInTheDocument()
  // The day cell shows a status label (not the workout title); 14% etc. comes
  // from the week-mileage summary. Click the "Done" day → onPick with its date.
  fireEvent.click(screen.getByRole('button', { name: /done/i }))
  expect(onPick).toHaveBeenCalledWith('2026-06-03')
})
