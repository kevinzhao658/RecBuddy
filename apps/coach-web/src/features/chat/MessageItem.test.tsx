import { render, screen, fireEvent } from '@testing-library/react'
import * as chatQueries from '../../lib/queries/chat'
import { MessageItem } from './MessageItem'

// useSignedImageUrl calls useQuery which needs a QueryClient context.
// Mock it at module level so ImageView renders without a provider in unit tests.
vi.mock('../../lib/queries/chat', () => ({
  useSignedImageUrl: vi.fn(() => ({ data: undefined })),
}))

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

test('a run card with a date shows day+date and opens that day on click', () => {
  const onOpenWorkout = vi.fn()
  render(<MessageItem mine={false} onOpenWorkout={onOpenWorkout}
    m={{ ...base, kind: 'runcard', body: null, workout_id: 'w3', payload: { title: 'Tempo 5 mi', dist: '5 mi', pace: '8:10/mi', time: '40:50', hr: 160, date: '2026-08-23' } } as any} />)
  expect(screen.getByText(/Sun, Aug 23/)).toBeInTheDocument()
  fireEvent.click(screen.getByText('Tempo 5 mi'))
  expect(onOpenWorkout).toHaveBeenCalledWith('2026-08-23')
})

test('a legacy run card without a date is not clickable', () => {
  const onOpenWorkout = vi.fn()
  render(<MessageItem mine={false} onOpenWorkout={onOpenWorkout}
    m={{ ...base, kind: 'runcard', body: null, payload: { title: 'Old Run', dist: '3 mi', pace: '9:00/mi', time: '27:00', hr: 140 } } as any} />)
  fireEvent.click(screen.getByText('Old Run'))
  expect(onOpenWorkout).not.toHaveBeenCalled()
})

test('renders an adjust card with from/to/reason', () => {
  render(<MessageItem mine={true} m={{ ...base, kind: 'adjust', body: null, payload: { from: '6 × 400m', to: '5 × 800m', reason: 'threshold' } } as any} />)
  expect(screen.getByText('6 × 400m')).toBeInTheDocument()
  expect(screen.getByText('5 × 800m')).toBeInTheDocument()
  expect(screen.getByText('threshold')).toBeInTheDocument()
})

test('renders a shared-workout card and opens its day on click', () => {
  const onOpenWorkout = vi.fn()
  render(<MessageItem mine={true} onOpenWorkout={onOpenWorkout}
    m={{ ...base, kind: 'workout', body: null, workout_id: 'w9', payload: { date: '2026-08-23', type: 'long', title: 'Long Run 11 mi', dist: 11, pace: '9:25/mi' } } as any} />)
  expect(screen.getByText('Long Run 11 mi')).toBeInTheDocument()
  expect(screen.getByText(/Aug 23/)).toBeInTheDocument()
  fireEvent.click(screen.getByText('Long Run 11 mi'))
  expect(onOpenWorkout).toHaveBeenCalledWith('2026-08-23')
})

test('renders an image message via signed URL when path is provided', () => {
  vi.mocked(chatQueries.useSignedImageUrl).mockReturnValue({ data: 'https://signed.example.com/img.jpg' } as any)
  render(<MessageItem mine={false}
    m={{ ...base, kind: 'image', body: null, payload: { path: 'thread-1/abc.jpg', w: 1280, h: 720 } } as any} />)
  const img = screen.getByRole('img')
  expect(img).toHaveAttribute('src', 'https://signed.example.com/img.jpg')
  expect(img).toHaveStyle('aspect-ratio: 1280/720')
  // The wrapping anchor must also point at the signed URL
  expect(screen.getByRole('link')).toHaveAttribute('href', 'https://signed.example.com/img.jpg')
})

test('renders an image caption below the photo when body is set', () => {
  vi.mocked(chatQueries.useSignedImageUrl).mockReturnValue({ data: 'https://signed.example.com/img.jpg' } as any)
  render(<MessageItem mine={true}
    m={{ ...base, kind: 'image', body: 'Post-run view from the ridge', payload: { path: 'thread-1/abc.jpg', w: 1280, h: 720 } } as any} />)
  expect(screen.getByRole('img')).toBeInTheDocument()
  expect(screen.getByText('Post-run view from the ridge')).toBeInTheDocument()
})

test('renders nothing for a legacy javascript: url (XSS guard)', () => {
  // path is absent → useSignedImageUrl called with null → returns undefined (default mock)
  render(<MessageItem mine={false}
    m={{ ...base, kind: 'image', body: null, payload: { url: 'javascript:alert(1)', w: 100, h: 100 } } as any} />)
  expect(screen.queryByRole('img')).toBeNull()
  expect(screen.queryByRole('link')).toBeNull()
})
