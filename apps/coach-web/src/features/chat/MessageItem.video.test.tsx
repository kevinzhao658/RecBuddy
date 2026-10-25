import { render, screen, fireEvent, act } from '@testing-library/react'
import { MessageItem } from './MessageItem'

vi.mock('../../lib/queries/chat', () => ({ useSignedImageUrl: vi.fn(() => ({ data: undefined })) }))
// The real player is covered in VideoView.test; here it's just a <video> with controls.
vi.mock('./VideoView', () => ({ VideoView: () => <video data-testid="inline-player" controls /> }))

const base = { id: '1', thread_id: 't', from_user_id: 'a', read: true, created_at: '2026-06-01T10:00:00Z' }

test('holding on a playing video scrubs it instead of opening the message menu', () => {
  vi.useFakeTimers()
  render(<MessageItem mine={false} actions={[{ key: 'reply', label: 'Reply', onClick: vi.fn() }]}
    m={{ ...base, kind: 'video', body: null, payload: { path: 't/v.mp4', poster: null, w: 720, h: 1280, duration_s: 6 } } as any} />)
  fireEvent.pointerDown(screen.getByTestId('inline-player'))
  act(() => { vi.advanceTimersByTime(600) })
  expect(screen.queryByRole('menu')).toBeNull()
  vi.useRealTimers()
})
