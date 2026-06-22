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

test('editing minutes preserves seconds', () => {
  const onChange = vi.fn()
  render(<PaceField value="8:30/mi" onChange={onChange} />)
  fireEvent.change(screen.getByLabelText(/pace minutes/i), { target: { value: '7' } })
  expect(onChange).toHaveBeenCalledWith('7:30/mi')
})
