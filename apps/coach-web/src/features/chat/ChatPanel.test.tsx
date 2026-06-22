import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ChatPanel } from './ChatPanel'
import * as chat from '../../lib/queries/chat'
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
  expect(send.mutate).toHaveBeenCalledWith('great run')
})

test('close button calls onClose', () => {
  setup()
  const onClose = vi.fn()
  wrap(<ChatPanel athleteId="a1" athleteName="Jordan Lee" onClose={onClose} />)
  fireEvent.click(screen.getByRole('button', { name: /close chat/i }))
  expect(onClose).toHaveBeenCalled()
})
