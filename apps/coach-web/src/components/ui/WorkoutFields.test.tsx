import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkoutFields, type WorkoutFieldsDraft } from './WorkoutFields'

/** Stateful harness — WorkoutFields is controlled, so patches must round-trip. */
function Harness({ initial }: { initial: Partial<WorkoutFieldsDraft> }) {
  const [d, setD] = useState<WorkoutFieldsDraft>({
    type: 'easy', title: 'Easy Run', dist: null, pace: null,
    est_minutes: null, note: '', sets: [], ...initial,
  })
  return <WorkoutFields draft={d} onChange={(p) => setD((x) => ({ ...x, ...p }))} />
}

test('total time is part of the standard field set (both editors aligned)', () => {
  render(<Harness initial={{}} />)
  expect(screen.getByLabelText('Total time')).toBeInTheDocument()
  expect(screen.getByLabelText('Distance')).toBeInTheDocument()
  expect(screen.getByLabelText('Pace')).toBeInTheDocument()
})

test("the 'other' type drops metrics but keeps phases and the note", () => {
  render(<Harness initial={{ type: 'other', title: 'Strength' }} />)
  expect(screen.queryByLabelText('Distance')).toBeNull()
  expect(screen.queryByLabelText('Pace')).toBeNull()
  expect(screen.queryByLabelText('Total time')).toBeNull()
  expect(screen.getByLabelText('Add phase')).toBeInTheDocument()
  expect(screen.getByLabelText('Note')).toBeInTheDocument()
})

test('cross keeps total time but drops distance and pace (athlete picks the sport)', () => {
  render(<Harness initial={{ type: 'cross', title: 'Cross Training' }} />)
  expect(screen.queryByLabelText('Distance')).toBeNull()
  expect(screen.queryByLabelText('Pace')).toBeNull()
  expect(screen.getByLabelText('Total time')).toBeInTheDocument()
})

test('switching a workout to Cross clears its distance and pace', () => {
  render(<Harness initial={{ dist: 5, pace: '9:00/mi' }} />)
  fireEvent.click(screen.getByRole('button', { name: /cross/i }))
  expect(screen.queryByLabelText('Distance')).toBeNull()
  // Switching back shows the fields again, now empty — the values were cleared.
  fireEvent.click(screen.getByRole('button', { name: /easy/i }))
  expect((screen.getByLabelText('Distance') as HTMLInputElement).value).toBe('')
})

test('editing distance + total time derives the pace (third field auto-calcs)', () => {
  render(<Harness initial={{}} />)
  fireEvent.change(screen.getByLabelText('Distance'), { target: { value: '5' } })
  fireEvent.change(screen.getByLabelText('Total time'), { target: { value: '50' } })
  // 50 min over 5 mi -> 10:00/mi, shown directly in the pace input
  expect((screen.getByLabelText('Pace') as HTMLInputElement).value).toBe('10:00')
})

test('editing pace + total time derives the distance', () => {
  render(<Harness initial={{}} />)
  fireEvent.change(screen.getByLabelText('Pace'), { target: { value: '1000' } })   // digit buffer -> 10:00/mi
  fireEvent.change(screen.getByLabelText('Total time'), { target: { value: '60' } })
  expect((screen.getByLabelText('Distance') as HTMLInputElement).value).toBe('6')
})

test('the derived field follows the two most recently edited', () => {
  render(<Harness initial={{}} />)
  fireEvent.change(screen.getByLabelText('Distance'), { target: { value: '4' } })
  fireEvent.change(screen.getByLabelText('Pace'), { target: { value: '900' } })     // 9:00/mi -> time derives (36)
  expect((screen.getByLabelText('Total time') as HTMLInputElement).value).toBe('36')
  // Now the user edits total time directly: time + pace become authoritative -> distance derives
  fireEvent.change(screen.getByLabelText('Total time'), { target: { value: '45' } })
  expect((screen.getByLabelText('Distance') as HTMLInputElement).value).toBe('5')
})
