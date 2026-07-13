import { render, screen, fireEvent } from '@testing-library/react'
import { DayCard } from './DayCard'

const w = { id: 'w1', title: '5 × 800m', dist: 6, pace: '7:30/mi', type: 'speed', status: 'today' } as any

test('renders workout summary and fires onClick', () => {
  const onClick = vi.fn()
  render(<DayCard workout={w} selected={false} onClick={onClick} onCopy={() => {}} />)
  expect(screen.getByText('5 × 800m')).toBeInTheDocument()
  expect(screen.getByText('6 mi · 7:30/mi')).toBeInTheDocument()
  fireEvent.click(screen.getByText('5 × 800m'))
  expect(onClick).toHaveBeenCalled()
})

test('copy button fires onCopy without selecting the card', () => {
  const onClick = vi.fn(); const onCopy = vi.fn()
  render(<DayCard workout={w} selected={false} onClick={onClick} onCopy={onCopy} />)
  fireEvent.click(screen.getByRole('button', { name: /copy workout/i }))
  expect(onCopy).toHaveBeenCalled()
  expect(onClick).not.toHaveBeenCalled()
})
