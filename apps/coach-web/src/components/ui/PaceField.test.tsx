import { render, screen, fireEvent } from '@testing-library/react'
import { PaceField, secondsToPace, paceToSeconds } from './PaceField'

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
