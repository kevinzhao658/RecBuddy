import { render, screen, fireEvent } from '@testing-library/react'
import { ModeSelect } from './ModeSelect'
import { vi } from 'vitest'

test('renders a sport dropdown and fires onChange with the picked mode', () => {
  const onChange = vi.fn()
  render(<ModeSelect mode="run" onChange={onChange} />)
  const select = screen.getByRole('combobox', { name: /volume sport/i })
  expect(select).toHaveValue('run')
  fireEvent.change(select, { target: { value: 'ride' } })
  expect(onChange).toHaveBeenCalledWith('ride')
})
