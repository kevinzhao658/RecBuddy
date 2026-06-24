import { render, screen, fireEvent } from '@testing-library/react'
import { WorkoutEditor } from './WorkoutEditor'

const base = { type: 'easy', title: 'Easy Run', dist: 4, pace: '9:30/mi', est_minutes: null, dur: null, note: '', sets: [] } as any

test('edits fields and calls onSave with the workout', () => {
  const onSave = vi.fn()
  render(<WorkoutEditor date="2026-09-08" workout={base} onSave={onSave} onClear={() => {}} />)
  fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Tempo 4 mi' } })
  fireEvent.click(screen.getByRole('button', { name: /^done$/i }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: 'Tempo 4 mi' }))
})

test('share button rewords to "Share changes" once the workout is edited', () => {
  const onShare = vi.fn()
  render(<WorkoutEditor date="2026-09-08" workout={base} onSave={() => {}} onClear={() => {}} onShare={onShare} />)
  expect(screen.getByRole('button', { name: /share to chat/i })).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText(/title/i), { target: { value: 'Tempo 5 mi' } })
  const changedBtn = screen.getByRole('button', { name: /share changes in chat/i })
  fireEvent.click(changedBtn)
  expect(onShare).toHaveBeenCalledWith(true, expect.objectContaining({ title: 'Tempo 5 mi' }))
})

test('adds a workout-structure phase and includes it on save', () => {
  const onSave = vi.fn()
  render(<WorkoutEditor date="2026-09-08" workout={{ ...base, type: 'speed', title: 'Intervals' }} onSave={onSave} onClear={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /add phase/i }))
  fireEvent.change(screen.getByLabelText(/phase 1 label/i), { target: { value: 'Warm-up' } })
  fireEvent.change(screen.getByLabelText(/phase 1 detail/i), { target: { value: '1 mi easy' } })
  fireEvent.click(screen.getByRole('button', { name: /^done$/i }))
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ sets: [['Warm-up', '1 mi easy']] }))
})
