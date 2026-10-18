import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ChatPanel } from './ChatPanel'
import * as chat from '../../lib/queries/chat'
import * as teamMod from '../../lib/queries/team'
import * as authMod from '../../auth/AuthProvider'

function setup() {
  const send = { mutate: vi.fn(), isPending: false }
  const markRead = { mutate: vi.fn() }
  vi.spyOn(authMod, 'useAuth').mockReturnValue({ session: { user: { id: 'coach1' } } } as any)
  vi.spyOn(chat, 'useThread').mockReturnValue({ data: { id: 'th1', athlete_id: 'a1', coach_id: 'coach1' } } as any)
  vi.spyOn(chat, 'useMessages').mockReturnValue({ data: [
    { id: 'm1', thread_id: 'th1', from_user_id: 'a1', kind: 'text', body: 'hey coach', payload: null, read: false, created_at: '2026-06-01T10:00:00Z' },
    { id: 'm2', thread_id: 'th1', from_user_id: 'coach1', kind: 'text', body: 'nice work', payload: null, read: true, created_at: '2026-06-01T10:01:00Z' },
  ], isLoading: false } as any)
  vi.spyOn(chat, 'useSendMessage').mockReturnValue(send as any)
  vi.spyOn(chat, 'useMarkThreadRead').mockReturnValue(markRead as any)
  vi.spyOn(chat, 'useRealtimeThread').mockReturnValue(undefined as any)
  vi.spyOn(teamMod, 'useTeam').mockReturnValue({ data: [{ coach_id: 'coach1', relationship: 'head', permission: 'admin', coach: { name: 'Mara Whitlock', title: 'Head Coach', initials: 'MW' } }] } as any)
  return { send, markRead }
}

function wrap(ui: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

test('renders the conversation and sends a typed message', () => {
  const { send, markRead } = setup()
  wrap(<ChatPanel athleteId="a1" athleteName="Jordan Lee" onClose={() => {}} />)
  expect(screen.getByText('hey coach')).toBeInTheDocument()
  expect(screen.getByText('nice work')).toBeInTheDocument()
  expect(markRead.mutate).toHaveBeenCalledWith('coach1') // marks athlete msgs read on open
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'great run' } })
  fireEvent.click(screen.getByRole('button', { name: /send message/i }))
  expect(send.mutate).toHaveBeenCalledWith({ body: 'great run', replyToId: null, workout: null })
})

test('close button calls onClose', () => {
  setup()
  const onClose = vi.fn()
  wrap(<ChatPanel athleteId="a1" athleteName="Jordan Lee" onClose={onClose} />)
  fireEvent.click(screen.getByRole('button', { name: /close chat/i }))
  expect(onClose).toHaveBeenCalled()
})

test('pasting an image stages it as an attachment; pasting text does not', () => {
  setup()
  vi.spyOn(chat, 'useSendImages').mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
  const created = vi.fn(() => 'blob:preview')
  Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() })
  wrap(<ChatPanel athleteId="a1" athleteName="Jordan Lee" onClose={() => {}} />)
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
  wrap(<ChatPanel athleteId="a1" athleteName="Jordan Lee" onClose={() => {}} />)
  fireEvent.contextMenu(screen.getByText('hey coach'))
  fireEvent.click(screen.getAllByRole('button', { name: 'Copy' })[0])
  expect(writeText).toHaveBeenCalledWith('hey coach')
})

test('Reply: shows the reply bar and sends with reply_to_id, then clears', () => {
  const { send } = setup()
  wrap(<ChatPanel athleteId="a1" athleteName="Jordan Lee" onClose={() => {}} />)
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
  wrap(<ChatPanel athleteId="a1" athleteName="Jordan Lee" onClose={() => {}} initialWorkout={w} />)
  expect(screen.getByText('About a workout')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'How did this feel?' } })
  fireEvent.click(screen.getByRole('button', { name: /send message/i }))
  expect(send.mutate).toHaveBeenCalledWith({ body: 'How did this feel?', replyToId: null, workout: w })
})
