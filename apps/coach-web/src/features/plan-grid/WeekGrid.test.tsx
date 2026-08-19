import { render, screen, fireEvent } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import { WeekGrid } from './WeekGrid'

const wk = (id: string, title: string) =>
  ({ id, title, date: '2026-09-07', type: 'easy', dist: 4, pace: '9:00/mi', status: 'planned', sets: [] }) as any

// Two workouts on Monday, everything else empty.
const week = [[wk('w1', 'AM Shakeout'), wk('w2', 'PM Track')], [], [], [], [], [], []]

function renderGrid(overrides: Partial<Parameters<typeof WeekGrid>[0]> = {}) {
  const props = {
    monday: '2026-09-07', week, selectedId: null,
    onSelectWorkout: vi.fn(), onCopy: vi.fn(), canPaste: false, onPaste: vi.fn(),
    ...overrides,
  }
  render(<DndContext><WeekGrid {...props} /></DndContext>)
  return props
}

test('stacks two workouts on one day, each selectable', () => {
  const { onSelectWorkout } = renderGrid()
  expect(screen.getByText('AM Shakeout')).toBeInTheDocument()
  expect(screen.getByText('PM Track')).toBeInTheDocument()
  fireEvent.click(screen.getByText('AM Shakeout'))
  expect(onSelectWorkout).toHaveBeenCalledWith('2026-09-07', 'w1')
  fireEvent.click(screen.getByText('PM Track'))
  expect(onSelectWorkout).toHaveBeenCalledWith('2026-09-07', 'w2')
})

test('stacks behind the selected workout — the rest collapse to slivers', () => {
  // Nothing selected: the first workout is the full card, the second a sliver.
  const { rerender } = render(<DndContext><WeekGrid {...{ monday: '2026-09-07', week, selectedId: null, onSelectWorkout: vi.fn(), onCopy: vi.fn(), canPaste: false, onPaste: vi.fn() }} /></DndContext>)
  expect(screen.getByRole('button', { name: /show pm track/i })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /show am shakeout/i })).toBeNull()

  // Selecting the second floats it up; the first drops to a sliver.
  rerender(<DndContext><WeekGrid {...{ monday: '2026-09-07', week, selectedId: 'w2', onSelectWorkout: vi.fn(), onCopy: vi.fn(), canPaste: false, onPaste: vi.fn() }} /></DndContext>)
  expect(screen.getByRole('button', { name: /show am shakeout/i })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /show pm track/i })).toBeNull()
})

test('every day keeps an Add affordance that opens a blank editor', () => {
  const { onSelectWorkout } = renderGrid()
  const adds = screen.getAllByRole('button', { name: /add workout/i })
  expect(adds.length).toBe(7) // occupied days still offer Add
  fireEvent.click(adds[0])
  expect(onSelectWorkout).toHaveBeenCalledWith('2026-09-07', null)
})

test('paste is offered on occupied days too when the clipboard is full', () => {
  const { onPaste } = renderGrid({ canPaste: true })
  const pastes = screen.getAllByRole('button', { name: /paste workout/i })
  expect(pastes.length).toBe(7)
  fireEvent.click(pastes[0])
  expect(onPaste).toHaveBeenCalledWith('2026-09-07')
})

test('an extra activity on an empty day renders as a full card, not the big add cell', () => {
  const extra = { id: 'x1', workout_id: null, athlete_id: 'a', dist: 5.2, pace: '9:00/mi',
    time: '46:48', hr: null, feel: null, note: null, source: 'apple_health',
    source_id: 'hk1', recorded_at: '2026-09-08T14:00:00Z' } as any
  renderGrid({ week: [[], [], [], [], [], [], []], extras: { '2026-09-08': [extra] } })
  expect(screen.getByText('Extra run')).toBeInTheDocument()
  expect(screen.getByText(/5\.2 mi · 46:48/)).toBeInTheDocument()
  // The day still offers Add (the slim sliver), like any occupied day.
  expect(screen.getAllByRole('button', { name: /add workout/i }).length).toBe(7)
})
