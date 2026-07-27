import { render, screen, fireEvent } from '@testing-library/react'
import { MonthDayModal } from './MonthDayModal'

const ws = [
  { id: 'a', date: '2026-09-23', type: 'easy', title: 'AM Shakeout', dist: 3, pace: '9:00/mi', est_minutes: null, dur: null, note: null, sets: [], status: 'done' },
  { id: 'b', date: '2026-09-23', type: 'speed', title: 'PM Track', dist: 6, pace: '7:30/mi', est_minutes: null, dur: null, note: 'bring spikes', sets: [], status: 'planned' },
] as any

test('lists the day’s workouts read-only and hands a pick back to the editor', () => {
  const onPick = vi.fn()
  render(<MonthDayModal open date="2026-09-23" workouts={ws} onPick={onPick} onClose={() => {}} />)
  expect(screen.getByText('AM Shakeout')).toBeInTheDocument()
  expect(screen.getByText('PM Track')).toBeInTheDocument()
  expect(screen.getByText(/2 workouts/i)).toBeInTheDocument()
  expect(screen.getByText(/completed/i)).toBeInTheDocument() // the done one
  fireEvent.click(screen.getByText('PM Track'))
  expect(onPick).toHaveBeenCalledWith('b')
})

test('closes from the ✕ button', () => {
  const onClose = vi.fn()
  render(<MonthDayModal open date="2026-09-23" workouts={ws} onPick={() => {}} onClose={onClose} />)
  fireEvent.click(screen.getByRole('button', { name: /close/i }))
  expect(onClose).toHaveBeenCalled()
})
