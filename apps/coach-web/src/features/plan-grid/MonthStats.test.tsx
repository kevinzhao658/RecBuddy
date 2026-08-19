import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { MonthStats } from './MonthStats'

const w = (id: string, date: string, dist: number, status = 'planned', type = 'easy') =>
  ({ id, date, type, dist, pace: '9:00/mi', est_minutes: null, dur: null, status, sets: [] }) as any

test('monthly mileage counts logged actuals and the dropdown swaps to ride volume', () => {
  const byDate = {
    '2026-08-03': [w('w1', '2026-08-03', 8, 'done')],
    '2026-08-04': [w('c1', '2026-08-04', 20, 'done', 'cross')],
  }
  const actuals = {
    w1: { id: 'a1', workout_id: 'w1', dist: 6.2, pace: '9:10/mi', time: '56:50' } as any,
    c1: { id: 'a2', workout_id: 'c1', dist: 18.5, pace: null, time: '1:02:00' } as any,
  }
  function Wrap() {
    const [mode, setMode] = useState<'run' | 'ride'>('run')
    return <MonthStats byDate={byDate} anchor="2026-08-01" actuals={actuals}
      mode={mode} onModeChange={setMode} />
  }
  render(<Wrap />)
  expect(screen.getByText('6.2')).toBeInTheDocument()          // run side, actuals-based
  fireEvent.change(screen.getByRole('combobox', { name: /volume sport/i }), { target: { value: 'ride' } })
  expect(screen.getByText('Ride mileage')).toBeInTheDocument()
  expect(screen.getByText('18.5')).toBeInTheDocument()
})
