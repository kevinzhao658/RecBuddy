import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { WeekStats } from './WeekStats'

const run = (id: string, dist: number, status = 'planned', type = 'easy') =>
  ({ id, type, dist, pace: '9:00/mi', est_minutes: null, dur: null, status, sets: [] }) as any
const act = (workout_id: string, dist: number, pace: string | null, time: string) =>
  ({ id: 'a1', workout_id, dist, pace, time }) as any

test('run-only week: no dropdown, done side uses the LOGGED distance', () => {
  render(<WeekStats week={[[run('w1', 8, 'done')], [], [], [], [], [], []]}
    actuals={{ w1: act('w1', 6.2, '9:10/mi', '56:50') }} mode="run" onModeChange={() => {}} />)
  expect(screen.queryByRole('combobox', { name: /volume sport/i })).toBeNull()
  expect(screen.getByText('Weekly mileage')).toBeInTheDocument()
  expect(screen.getByText('6.2')).toBeInTheDocument()
  expect(screen.getByText(/\/ 8\.0 mi/)).toBeInTheDocument()
})

test('without a log, done falls back to planned (old behavior preserved)', () => {
  render(<WeekStats week={[[run('w1', 3, 'done'), run('w2', 4)], [run('w3', 5)], [], [], [], [], []]} />)
  expect(screen.getByText('3.0')).toBeInTheDocument()
  expect(screen.getByText(/\/ 12\.0 mi/)).toBeInTheDocument()
})

test('ride volume reveals the dropdown; selecting Ride shows ride numbers', () => {
  function Wrap() {
    const [mode, setMode] = useState<'run' | 'ride'>('run')
    const week = [[run('w1', 8), run('c1', 15, 'done', 'cross')], [], [], [], [], [], []]
    return <WeekStats week={week} actuals={{ c1: act('c1', 12.4, null, '48:00') }}
      mode={mode} onModeChange={setMode} />
  }
  render(<Wrap />)
  fireEvent.change(screen.getByRole('combobox', { name: /volume sport/i }), { target: { value: 'ride' } })
  expect(screen.getByText('Ride mileage')).toBeInTheDocument()
  expect(screen.getByText('12.4')).toBeInTheDocument()
  expect(screen.getByText(/\/ 15\.0 mi/)).toBeInTheDocument()
})

test('time on feet uses logged elapsed when present', () => {
  render(<WeekStats week={[[run('w1', 6, 'done')], [run('w2', 6)], [], [], [], [], []]}
    actuals={{ w1: act('w1', 6, '9:00/mi', '50:00') }} />)
  expect(screen.getByText('50m')).toBeInTheDocument()   // logged, not est 54m
  expect(screen.getByText(/\/ 1h 48m/)).toBeInTheDocument()
})
