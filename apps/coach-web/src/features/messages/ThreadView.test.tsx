import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ThreadView } from './ThreadView'
import * as chat from '../../lib/queries/chat'
import * as convMod from '../../lib/queries/conversations'
import * as authMod from '../../auth/AuthProvider'

function setup() {
  const send = { mutate: vi.fn(), isPending: false }
  const markRead = { mutate: vi.fn() }
  vi.spyOn(authMod, 'useAuth').mockReturnValue({ session: { user: { id: 'coach1' } } } as any)
  vi.spyOn(chat, 'useMessages').mockReturnValue({ data: [
    { id: 'm1', thread_id: 'th1', from_user_id: 'a1', kind: 'text', body: 'hey coach', payload: null, read: false, created_at: '2026-06-01T10:00:00Z' },
    { id: 'm2', thread_id: 'th1', from_user_id: 'coach1', kind: 'text', body: 'nice work', payload: null, read: true, created_at: '2026-06-01T10:01:00Z' },
  ], isLoading: false } as any)
  vi.spyOn(chat, 'useSendMessage').mockReturnValue(send as any)
  vi.spyOn(chat, 'useMarkThreadRead').mockReturnValue(markRead as any)
  vi.spyOn(chat, 'useRealtimeThread').mockReturnValue(undefined as any)
  vi.spyOn(convMod, 'useThreadPeople').mockReturnValue({ data: [
    { user_id: 'a1', name: 'Jordan Lee', initials: 'JL', avatar_url: null, title: null },
    { user_id: 'coach1', name: 'Mara Whitlock', initials: 'MW', avatar_url: null, title: 'Head Coach' },
  ] } as any)
  return { send, markRead }
}

const team = { thread_id: 'th1', kind: 'team', title: null, team_athlete_id: 'a1',
  members: [{ user_id: 'a1', name: 'Jordan Lee', initials: 'JL', avatar_url: null }],
  last_body: null, last_kind: null, last_from: null, last_at: null, unread: 0, read_only: false } as any

function wrap(ui: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

test('renders the conversation and sends a typed message', () => {
  const { send, markRead } = setup()
  wrap(<ThreadView threadId="th1" conversation={team} />)
  expect(screen.getByText('hey coach')).toBeInTheDocument()
  expect(screen.getByText('nice work')).toBeInTheDocument()
  expect(markRead.mutate).toHaveBeenCalled() // marks the thread read on open
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'great run' } })
  fireEvent.click(screen.getByRole('button', { name: /send message/i }))
  expect(send.mutate).toHaveBeenCalledWith({ body: 'great run', replyToId: null, workout: null })
})


test('pasting an image stages it as an attachment; pasting text does not', () => {
  setup()
  vi.spyOn(chat, 'useSendImages').mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
  const created = vi.fn(() => 'blob:preview')
  Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() })
  wrap(<ThreadView threadId="th1" conversation={team} />)
  const box = screen.getByLabelText('Message')
  fireEvent.paste(box, { clipboardData: { files: [], getData: () => 'hello' } })
  expect(screen.queryByAltText('Attached photo 1')).toBeNull()
  const shot = new File(['x'], 'shot.png', { type: 'image/png' })
  fireEvent.paste(box, { clipboardData: { files: [shot], getData: () => '' } })
  expect(screen.getByAltText('Attached photo 1')).toBeInTheDocument()
  expect(screen.getByText(/Photo attached/)).toBeInTheDocument()
})

test('messages get a Copy action that writes the text to the clipboard', async () => {
  setup()
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
  wrap(<ThreadView threadId="th1" conversation={team} />)
  fireEvent.contextMenu(screen.getByText('hey coach'))
  fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[0])
  expect(writeText).toHaveBeenCalledWith('hey coach')
})

test('Reply: shows the reply bar and sends with reply_to_id, then clears', () => {
  const { send } = setup()
  wrap(<ThreadView threadId="th1" conversation={team} />)
  fireEvent.contextMenu(screen.getByText('hey coach'))
  fireEvent.click(screen.getAllByRole('button', { name: 'Reply' })[0])
  expect(screen.getByText('Replying to Jordan Lee')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'on it' } })
  fireEvent.click(screen.getByRole('button', { name: /send message/i }))
  expect(send.mutate).toHaveBeenCalledWith({ body: 'on it', replyToId: 'm1', workout: null })
  expect(screen.queryByText('Replying to Jordan Lee')).toBeNull()
})

test('initialWorkout attaches the workout to the next message', () => {
  const { send } = setup()
  const w = { id: 'w9', date: '2026-10-18', type: 'long', title: 'Long Run 14 mi' } as any
  wrap(<ThreadView threadId="th1" conversation={team} initialWorkout={w} />)
  expect(screen.getByText('About a workout')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'How did this feel?' } })
  fireEvent.click(screen.getByRole('button', { name: /send message/i }))
  expect(send.mutate).toHaveBeenCalledWith({ body: 'How did this feel?', replyToId: null, workout: w })
})

test('header shows the conversation title, and a read-only thread has no composer', () => {
  setup()
  wrap(<ThreadView threadId="th1" conversation={{ ...team, read_only: true }} />)
  expect(screen.getByText('Jordan Lee · Team')).toBeInTheDocument()
  expect(screen.getByText('This conversation is read-only.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Message')).toBeNull()
})
