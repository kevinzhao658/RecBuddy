import { render, screen } from '@testing-library/react'
import { MessageItem } from './MessageItem'

const base = { id: '1', thread_id: 't', from_user_id: 'a', read: true, created_at: '2026-06-01T10:00:00Z' }

test('renders a text bubble', () => {
  render(<MessageItem mine={false} m={{ ...base, kind: 'text', body: 'hi coach', payload: null } as any} />)
  expect(screen.getByText('hi coach')).toBeInTheDocument()
})

test('renders a run card with its stats', () => {
  render(<MessageItem mine={false} m={{ ...base, kind: 'runcard', body: null, payload: { title: 'Long Run 9 mi', dist: '9.1 mi', pace: '9:22/mi', time: '1:25:14', hr: 152 } } as any} />)
  expect(screen.getByText('Long Run 9 mi')).toBeInTheDocument()
  expect(screen.getByText('9.1 mi')).toBeInTheDocument()
  expect(screen.getByText(/152/)).toBeInTheDocument()
})

test('renders an adjust card with from/to/reason', () => {
  render(<MessageItem mine={true} m={{ ...base, kind: 'adjust', body: null, payload: { from: '6 × 400m', to: '5 × 800m', reason: 'threshold' } } as any} />)
  expect(screen.getByText('6 × 400m')).toBeInTheDocument()
  expect(screen.getByText('5 × 800m')).toBeInTheDocument()
  expect(screen.getByText('threshold')).toBeInTheDocument()
})
