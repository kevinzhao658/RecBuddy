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

test('shows a "Delete workout" button only when editing an existing workout', () => {
  const onClear = vi.fn()
  const { rerender } = render(<WorkoutEditor date="2026-09-08" workout={null} onSave={() => {}} onClear={onClear} />)
  expect(screen.queryByRole('button', { name: /delete workout/i })).toBeNull() // hidden for a new workout
  rerender(<WorkoutEditor date="2026-09-08" workout={base} onSave={() => {}} onClear={onClear} canDelete />)
  fireEvent.click(screen.getByRole('button', { name: /delete workout/i }))
  expect(onClear).toHaveBeenCalled()
})

test('readOnly hides Done/Delete and the share button, and disables the fields', () => {
  render(<WorkoutEditor date="2026-09-08" workout={base} onSave={() => {}} onClear={() => {}} onShare={() => {}} canDelete readOnly />)
  expect(screen.queryByRole('button', { name: /^done$/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /delete workout/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /share to chat/i })).not.toBeInTheDocument()
  expect(screen.getByLabelText(/title/i)).toBeDisabled()
  expect(screen.getByText(/view-only access/i)).toBeInTheDocument()
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

test('total time can be deleted to blank while editing (no snap-back to auto)', () => {
  // base has dist 4 @ 9:30/mi -> auto estimate 38 renders in the field.
  render(<WorkoutEditor date="2026-09-08" workout={base} onSave={() => {}} onClear={() => {}} />)
  const time = screen.getByLabelText(/total time/i) as HTMLInputElement
  expect(time.value).toBe('38')
  fireEvent.focus(time)
  fireEvent.change(time, { target: { value: '' } })
  expect(time.value).toBe('') // stays blank while focused — not refilled with 38
  fireEvent.blur(time)
  expect(time.value).toBe('38') // blur returns the live auto estimate
})
