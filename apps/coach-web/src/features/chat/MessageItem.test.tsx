import { render, screen, fireEvent, act } from '@testing-library/react'
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
    m={{ ...base, kind: 'runcard', body: null, workout_id: 'w3', payload: { title: 'Tempo 5 mi', dist: '5 mi', pace: '8:10/mi', time: '40:50', hr: 160, date: '2026-08-23', type: 'tempo', note: 'Legs felt heavy' } } as any} />)
  expect(screen.getByText(/Sun, Aug 23/)).toBeInTheDocument()
  expect(screen.getByText(/Legs felt heavy/)).toBeInTheDocument()  // athlete's comment visible to the coach
  fireEvent.click(screen.getByText('Tempo 5 mi'))
  expect(onOpenWorkout).toHaveBeenCalledWith('2026-08-23', 'w3')
})

test('a superseded card rolls up into a placeholder that jumps to the newest card', () => {
  const onJumpToLatest = vi.fn()
  render(<MessageItem mine={false} superseded onJumpToLatest={onJumpToLatest}
    m={{ ...base, kind: 'runcard', body: null, workout_id: 'w1', payload: { title: 'Long Run', dist: '14 mi', pace: '9:00/mi', time: '2:06:00', hr: 150, date: '2026-07-12', type: 'long' } } as any} />)
  expect(screen.getByText(/log updated below/)).toBeInTheDocument()
  expect(screen.queryByText('14 mi')).toBeNull()          // full stats hidden
  fireEvent.click(screen.getByText(/Long Run/))
  expect(onJumpToLatest).toHaveBeenCalled()                // scrolls to the latest card
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
  expect(onOpenWorkout).toHaveBeenCalledWith('2026-08-23', 'w9')
})

test('renders an image message via signed URL when path is provided', () => {
  vi.mocked(chatQueries.useSignedImageUrl).mockReturnValue({ data: 'https://signed.example.com/img.jpg' } as any)
  render(<MessageItem mine={false}
    m={{ ...base, kind: 'image', body: null, payload: { path: 'thread-1/abc.jpg', w: 1280, h: 720 } } as any} />)
  const img = screen.getByRole('img')
  expect(img).toHaveAttribute('src', 'https://signed.example.com/img.jpg')
  expect(img).toHaveStyle({ width: '240px', height: '135px' })   // 1280×720 at thumbnail size
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

const hold = (el: Element) => { fireEvent.pointerDown(el); act(() => { vi.advanceTimersByTime(500) }) }

test('menu: only press-and-hold opens it; the bubble presses in, then pops into focus', () => {
  vi.useFakeTimers()
  render(<MessageItem mine={false} actions={[{ key: 'copy', label: 'Copy', onClick: vi.fn() }]}
    m={{ ...base, kind: 'text', body: 'copy me', payload: null } as any} />)
  const bubble = screen.getByText('copy me')
  const wrap = bubble.closest('.group\\/msg')!
  // hover, right-click, and a quick click don't open it
  fireEvent.mouseEnter(bubble)
  fireEvent.contextMenu(bubble)
  fireEvent.pointerDown(bubble)
  expect(wrap.getAttribute('data-pressing')).toBe('true')
  act(() => { vi.advanceTimersByTime(200) }); fireEvent.pointerUp(bubble)
  expect(wrap.getAttribute('data-pressing')).toBeNull()
  act(() => { vi.advanceTimersByTime(1000) })
  expect(screen.queryByRole('menu')).toBeNull()
  // holding does: a dimmed backdrop, a lifted copy of the bubble, and the menu
  hold(bubble)
  expect(screen.getByRole('menu', { name: 'Message actions' })).toBeInTheDocument()
  expect(screen.getByTestId('message-focus-backdrop')).toBeInTheDocument()
  expect(screen.getByTestId('message-focus-preview')).toHaveTextContent('copy me')
  vi.useRealTimers()
})

test('menu: an item runs its action and closes; Copy shows Copied first', async () => {
  vi.useFakeTimers()
  const reply = vi.fn(), copy = vi.fn()
  render(<MessageItem mine={false} actions={[
    { key: 'reply', label: 'Reply', icon: 'reply', onClick: reply },
    { key: 'copy', label: 'Copy', icon: 'copy', doneLabel: 'Copied', onClick: copy },
  ]} m={{ ...base, kind: 'text', body: 'hold me', payload: null } as any} />)
  hold(screen.getByText('hold me'))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Reply' }))
  expect(reply).toHaveBeenCalled()
  expect(screen.queryByRole('menu')).toBeNull()
  hold(screen.getByText('hold me'))
  await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' })) })
  expect(copy).toHaveBeenCalled()
  expect(screen.getByRole('menuitem', { name: 'Copied' })).toBeInTheDocument()
  act(() => { vi.advanceTimersByTime(1000) })
  expect(screen.queryByRole('menu')).toBeNull()
  vi.useRealTimers()
})

test('menu: clicking the backdrop or pressing Escape closes it', () => {
  vi.useFakeTimers()
  render(<MessageItem mine={false} actions={[{ key: 'reply', label: 'Reply', onClick: vi.fn() }]}
    m={{ ...base, kind: 'text', body: 'close me', payload: null } as any} />)
  hold(screen.getByText('close me'))
  fireEvent.click(screen.getByTestId('message-focus-backdrop'))
  expect(screen.queryByRole('menu')).toBeNull()
  hold(screen.getByText('close me'))
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
  expect(screen.queryByRole('menu')).toBeNull()
  vi.useRealTimers()
})

test('menu: the emoji row reacts, mine are marked, and Remove rows take mine off', () => {
  vi.useFakeTimers()
  const onReact = vi.fn()
  const reactions = [{ kind: 'like', emoji: '👍', label: 'Like', count: 1, mine: true, names: ['You'] }] as any
  render(<MessageItem mine={false} actions={[{ key: 'reply', label: 'Reply', onClick: vi.fn() }]}
    reactions={reactions} onReact={onReact}
    m={{ ...base, kind: 'text', body: 'react to me', payload: null } as any} />)
  hold(screen.getByText('react to me'))
  const row = screen.getByRole('group', { name: 'Reactions' })
  expect(row.querySelectorAll('button')).toHaveLength(5)
  expect(screen.getByRole('button', { name: 'Like' })).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(screen.getByRole('button', { name: 'Laugh' }))
  expect(onReact).toHaveBeenCalledWith('laugh')
  expect(screen.queryByRole('menu')).toBeNull()
  hold(screen.getByText('react to me'))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Remove 👍' }))
  expect(onReact).toHaveBeenLastCalledWith('like')
  vi.useRealTimers()
})

test('menu: using it does not leave all five chips open under the bubble', () => {
  vi.useFakeTimers()
  render(<MessageItem mine={false} actions={[{ key: 'reply', label: 'Reply', onClick: vi.fn() }]} onReact={vi.fn()}
    m={{ ...base, kind: 'text', body: 'stay tidy', payload: null } as any} />)
  hold(screen.getByText('stay tidy'))
  fireEvent.focus(screen.getByRole('menuitem', { name: 'Reply' }))
  fireEvent.click(screen.getByTestId('message-focus-backdrop'))
  expect(screen.queryByRole('button', { name: 'Laugh' })).toBeNull()
  vi.useRealTimers()
})

test('menu: destructive items are marked and a divider sets off the report group', () => {
  vi.useFakeTimers()
  render(<MessageItem mine={false} actions={[
    { key: 'reply', label: 'Reply', onClick: vi.fn() },
    { key: 'report', label: 'Report message', separated: true, onClick: vi.fn() },
    { key: 'block', label: 'Block Maya', destructive: true, onClick: vi.fn() },
  ]} m={{ ...base, kind: 'text', body: 'mod me', payload: null } as any} />)
  hold(screen.getByText('mod me'))
  expect(screen.getAllByRole('separator')).toHaveLength(1)
  expect(screen.getByRole('menuitem', { name: 'Block Maya' }).className).toMatch(/text-missed/)
  vi.useRealTimers()
})

test('no action bar on rolled-up placeholders or when there are no actions', () => {
  render(<MessageItem mine={false} m={{ ...base, kind: 'text', body: 'plain', payload: null } as any} />)
  expect(screen.queryByRole('toolbar')).toBeNull()
})

test('a reply shows its quote; clicking it jumps to the original', () => {
  const onClick = vi.fn()
  render(<MessageItem mine={false} quote={{ author: 'Jordan', text: 'How was the tempo?', available: true, onClick }}
    m={{ ...base, kind: 'text', body: 'Strong!', payload: null, reply_to_id: 'm0' } as any} />)
  fireEvent.click(screen.getByRole('button', { name: /Reply to Jordan: How was the tempo\?/ }))
  expect(onClick).toHaveBeenCalled()
})

test('a reply to a deleted message says the original is unavailable', () => {
  render(<MessageItem mine quote={{ author: '', text: '', available: false }}
    m={{ ...base, kind: 'text', body: 'ok', payload: null, reply_to_id: 'gone' } as any} />)
  expect(screen.getByText('Original message unavailable')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /unavailable message/ })).toBeDisabled()
})

test('a message about a workout shows a workout chip that opens the day', () => {
  const onOpenWorkout = vi.fn()
  render(<MessageItem mine={false} onOpenWorkout={onOpenWorkout}
    m={{ ...base, kind: 'text', body: 'Legs ok after this?', workout_id: 'w9',
      payload: { quote: 'workout', title: 'Long Run 14 mi', date: '2026-10-18', type: 'long' } } as any} />)
  fireEvent.click(screen.getByRole('button', { name: /Long Run 14 mi/ }))
  expect(onOpenWorkout).toHaveBeenCalledWith('2026-10-18', 'w9')
})

test('reactions: used chips show under the bubble; hovering reveals all five; click reacts', () => {
  const onReact = vi.fn()
  const reactions = [{ kind: 'like', emoji: '👍', label: 'Like', count: 1, mine: false, names: ['Maya'] }] as any
  render(<MessageItem mine={false} actions={[{ key: 'copy', label: 'Copy', onClick: () => {} }]}
    reactions={reactions} onReact={onReact}
    m={{ ...base, kind: 'text', body: 'tempo felt great', payload: null } as any} />)
  expect(screen.getByRole('button', { name: 'Like, 1: Maya' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Laugh' })).toBeNull()
  fireEvent.mouseEnter(screen.getByText('tempo felt great').closest('.group\\/msg')!)
  fireEvent.click(screen.getByRole('button', { name: 'Laugh' }))
  expect(onReact).toHaveBeenCalledWith('laugh')
  fireEvent.mouseLeave(screen.getByText('tempo felt great').closest('.group\\/msg')!)
  expect(screen.queryByRole('button', { name: 'Laugh' })).toBeNull()
})

test('keyboard: the hidden options button opens the menu and focuses its first item', () => {
  const onReact = vi.fn()
  render(<MessageItem mine={false} actions={[{ key: 'copy', label: 'Copy', onClick: vi.fn() }]} onReact={onReact}
    m={{ ...base, kind: 'text', body: 'tab to me', payload: null } as any} />)
  expect(screen.queryByRole('button', { name: 'Laugh' })).toBeNull()
  const opts = screen.getByRole('button', { name: 'Message options' })
  fireEvent.focus(opts)
  // focusing the message also reveals all five chips under it
  expect(screen.getByRole('button', { name: 'Laugh' })).toBeInTheDocument()
  fireEvent.click(opts)
  expect(screen.getByRole('menuitem', { name: 'Copy' })).toHaveFocus()
})

test('a tall photo shows at thumbnail size, not full size', () => {
  render(<MessageItem mine={false}
    m={{ ...base, kind: 'image', body: null, payload: { url: 'https://x/p.jpg', w: 665, h: 1182 } } as any} />)
  const img = screen.getByRole('img', { name: 'Chat image' })
  expect(img.style.width).toBe('180px')
  expect(img.style.height).toBe('320px')
})

test('an edited message says so', () => {
  render(<MessageItem mine m={{ ...base, kind: 'text', body: 'fixed typo', payload: null, edited_at: '2026-06-01T10:05:00Z' } as any} />)
  expect(screen.getByText('Edited')).toBeInTheDocument()
})
