import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import * as convMod from '../../lib/queries/conversations'
import * as chatMod from '../../lib/queries/chat'
import { ComposePane } from './ComposePane'

const people = [
  { user_id: 'a1', name: 'Maya Chen', initials: 'MC', avatar_url: null, person_kind: 'athlete', context: 'Your athlete' },
  { user_id: 'a2', name: 'Jordan Lee', initials: 'JL', avatar_url: null, person_kind: 'athlete', context: 'Your athlete' },
  { user_id: 'c2', name: 'Marcus Hale', initials: 'MH', avatar_url: null, person_kind: 'coach', context: 'Coaches Maya with you' },
]
const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

function setup() {
  const search = vi.spyOn(convMod, 'useSearchPeople').mockReturnValue({ data: people } as any)
  const start = { mutateAsync: vi.fn().mockResolvedValue('t9'), isPending: false }
  vi.spyOn(convMod, 'useStartConversation').mockReturnValue(start as any)
  const send = vi.spyOn(chatMod, 'sendMessage').mockResolvedValue(undefined)
  return { search, start, send }
}

test('typing searches; results group athletes then coaches with context', () => {
  const { search } = setup()
  wrap(<ComposePane onOpen={() => {}} onCancel={() => {}} />)
  fireEvent.change(screen.getByLabelText('To'), { target: { value: 'ma' } })
  expect(search).toHaveBeenLastCalledWith('ma')
  expect(screen.getByText('Athletes')).toBeInTheDocument()
  expect(screen.getByText('Coaches Maya with you')).toBeInTheDocument()
})

test('picking two athletes shows the note and a group name field', () => {
  setup()
  wrap(<ComposePane onOpen={() => {}} onCancel={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /Maya Chen/ }))
  expect(screen.queryByText(/see each other's names/)).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Jordan Lee/ }))
  expect(screen.getByText("Athletes in this group will see each other's names and messages.")).toBeInTheDocument()
  expect(screen.getByLabelText('Group name')).toBeInTheDocument()
})

test('Send starts (or reopens) the conversation, posts the first message, and opens it', async () => {
  const { start, send } = setup()
  const onOpen = vi.fn()
  wrap(<ComposePane onOpen={onOpen} onCancel={() => {}} />)
  fireEvent.click(screen.getByRole('button', { name: /Marcus Hale/ }))
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Quick sync on Maya?' } })
  fireEvent.click(screen.getByRole('button', { name: 'Send' }))
  await waitFor(() => expect(onOpen).toHaveBeenCalledWith('t9'))
  expect(start.mutateAsync).toHaveBeenCalledWith({ userIds: ['c2'], title: null })
  expect(send).toHaveBeenCalledWith(expect.anything(), 't9', { body: 'Quick sync on Maya?' })
})
