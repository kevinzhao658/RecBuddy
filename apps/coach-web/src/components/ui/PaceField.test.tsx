import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { PaceField, secondsToPace, paceToSeconds } from './PaceField'

/** Controlled like the real editor: onChange feeds back into value. */
function Controlled({ initial }: { initial: string }) {
  const [v, setV] = useState(initial)
  return <PaceField value={v} onChange={setV} />
}

test('round-trips pace <-> seconds', () => {
  expect(paceToSeconds('8:30/mi')).toBe(510)
  expect(secondsToPace(510)).toBe('8:30/mi')
  expect(secondsToPace(485)).toBe('8:05/mi') // pads seconds
})

test('steppers adjust pace by 15s and keep the /mi unit', () => {
  const onChange = vi.fn()
  render(<PaceField value="8:30/mi" onChange={onChange} />)
  fireEvent.click(screen.getByRole('button', { name: /increase pace by 15 seconds/i }))
  expect(onChange).toHaveBeenCalledWith('8:45/mi')
  fireEvent.click(screen.getByRole('button', { name: /decrease pace by 15 seconds/i }))
  expect(onChange).toHaveBeenCalledWith('8:15/mi')
})

test('km mode displays per-km and emits a canonical /mi value', () => {
  const onChange = vi.fn()
  render(<PaceField value="8:30/mi" unit="km" onChange={onChange} />)
  expect(screen.getByLabelText('Pace')).toHaveValue('5:17') // 8:30/mi shown as ~5:17/km
  expect(screen.getByText('/km')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /increase pace by 15 seconds/i }))
  expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/\/mi$/)) // still canonical /mi
})

test('typing 7-3-0 keystroke-by-keystroke yields 7:30, not 11:30 (regression)', () => {
  // Real typing appends to the CURRENT display. Without a typing buffer, the
  // intermediate "73" seconds normalizes to 1:13, and the next keystroke
  // re-parses "1:13"+"0" as 11:30 — the +4-minutes carry bug.
  render(<Controlled initial="9:30/mi" />)
  const input = screen.getByLabelText('Pace') as HTMLInputElement
  fireEvent.change(input, { target: { value: '7' } })                 // select-all + type 7
  fireEvent.change(input, { target: { value: input.value + '3' } })   // append 3
  fireEvent.change(input, { target: { value: input.value + '0' } })   // append 0
  expect(input.value).toBe('7:30')
  fireEvent.blur(input)
  expect(input.value).toBe('7:30') // normalized display after editing ends
})

test('typed digits fill MM:SS from the right, spilling into minutes past 2', () => {
  const onChange = vi.fn()
  render(<PaceField value="8:30/mi" onChange={onChange} />)
  const input = screen.getByLabelText('Pace')
  fireEvent.change(input, { target: { value: '45' } })   // two digits -> seconds
  expect(onChange).toHaveBeenLastCalledWith('0:45/mi')
  fireEvent.change(input, { target: { value: '730' } })  // third digit spills to minutes
  expect(onChange).toHaveBeenLastCalledWith('7:30/mi')
  fireEvent.change(input, { target: { value: '1245' } }) // 12:45
  expect(onChange).toHaveBeenLastCalledWith('12:45/mi')
})
