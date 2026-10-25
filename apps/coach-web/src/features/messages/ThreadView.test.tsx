import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { ThreadView } from './ThreadView'
import * as chat from '../../lib/queries/chat'
import * as convMod from '../../lib/queries/conversations'
import * as reactMod from '../../lib/queries/reactions'
import * as modMod from '../../lib/queries/moderation'
import * as authMod from '../../auth/AuthProvider'
import * as videoFile from '../../lib/videoFile'

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
  vi.spyOn(reactMod, 'useReactions').mockReturnValue({ data: [{ message_id: 'm1', user_id: 'coach1', kind: 'like' }] } as any)
  const react = { mutate: vi.fn() }
  vi.spyOn(reactMod, 'useSetReaction').mockReturnValue(react as any)
  vi.spyOn(convMod, 'useThreadPeople').mockReturnValue({ data: [
    { user_id: 'a1', name: 'Jordan Lee', initials: 'JL', avatar_url: null, title: null },
    { user_id: 'coach1', name: 'Mara Whitlock', initials: 'MW', avatar_url: null, title: 'Head Coach' },
  ] } as any)
  return { send, markRead, react }
}

const team = { thread_id: 'th1', kind: 'team', title: null, team_athlete_id: 'a1',
  members: [{ user_id: 'a1', name: 'Jordan Lee', initials: 'JL', avatar_url: null }],
  last_body: null, last_kind: null, last_from: null, last_at: null, unread: 0, read_only: false } as any

function wrap(ui: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

/** Open a message's press-and-hold menu (via its keyboard options button). */
const openMenu = (text: string) =>
  fireEvent.click(within(screen.getByText(text).closest('.group\\/msg') as HTMLElement).getByRole('button', { name: 'Message options' }))

test('renders the conversation and sends a typed message', () => {
  const { send, markRead } = setup()
  wrap(<ThreadView threadId="th1" conversation={team} />)
  expect(screen.getByText('hey coach')).toBeInTheDocument()
  expect(screen.getByText('nice work')).toBeInTheDocument()
  expect(markRead.mutate).toHaveBeenCalled() // marks the thread read on open
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'great run' } })
  fireEvent.click(screen.getByRole('button', { name: /send message/i }))
  expect(send.mutate).toHaveBeenCalledWith({ body: 'great run', replyToId: null, workout: null }, expect.anything())
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
  openMenu('hey coach')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Copy' }))
  expect(writeText).toHaveBeenCalledWith('hey coach')
})

test('Reply: shows the reply bar and sends with reply_to_id, then clears', () => {
  const { send } = setup()
  wrap(<ThreadView threadId="th1" conversation={team} />)
  openMenu('hey coach')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Reply' }))
  expect(screen.getByText('Replying to Jordan Lee')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'on it' } })
  fireEvent.click(screen.getByRole('button', { name: /send message/i }))
  expect(send.mutate).toHaveBeenCalledWith({ body: 'on it', replyToId: 'm1', workout: null }, expect.anything())
  expect(screen.queryByText('Replying to Jordan Lee')).toBeNull()
})

test('initialWorkout attaches the workout to the next message', () => {
  const { send } = setup()
  const w = { id: 'w9', date: '2026-10-18', type: 'long', title: 'Long Run 14 mi' } as any
  wrap(<ThreadView threadId="th1" conversation={team} initialWorkout={w} />)
  expect(screen.getByText('About a workout')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'How did this feel?' } })
  fireEvent.click(screen.getByRole('button', { name: /send message/i }))
  expect(send.mutate).toHaveBeenCalledWith({ body: 'How did this feel?', replyToId: null, workout: w }, expect.anything())
})

test('header shows the conversation title, and a read-only thread has no composer', () => {
  setup()
  const { container } = wrap(<ThreadView threadId="th1" conversation={{ ...team, read_only: true }} />)
  expect(container.querySelector('header')).toHaveTextContent(/^Jordan Lee2 people/)
  expect(screen.getByText('This conversation is read-only.')).toBeInTheDocument()
  expect(screen.queryByLabelText('Message')).toBeNull()
})

test('reactions show under messages with names, and clicking a chip reacts', () => {
  const { react } = setup()
  wrap(<ThreadView threadId="th1" conversation={team} />)
  expect(screen.getByRole('button', { name: 'Like, 1: You' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Like, 1: You' }))
  expect(react.mutate).toHaveBeenCalledWith({ messageId: 'm1', kind: 'like' })
})

test("other people's messages offer Report and Block; Block confirms then blocks", async () => {
  setup()
  const block = vi.spyOn(modMod, 'blockUser').mockResolvedValue(undefined)
  wrap(<ThreadView threadId="th1" conversation={team} />)
  openMenu('hey coach')
  expect(screen.getByRole('menuitem', { name: 'Report message' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('menuitem', { name: 'Block Jordan Lee' }))
  fireEvent.click(screen.getByRole('button', { name: 'Block' }))
  await vi.waitFor(() => expect(block).toHaveBeenCalledWith(expect.anything(), 'a1'))
})

test('blocking the athlete in their team chat refreshes the roster and closes the thread', async () => {
  setup()
  vi.spyOn(modMod, 'blockUser').mockResolvedValue(undefined)
  vi.spyOn(convMod, 'fetchConversations').mockResolvedValue([])   // the thread is gone for me now
  const qc = new QueryClient()
  const invalidate = vi.spyOn(qc, 'invalidateQueries')
  const onGone = vi.fn()
  render(<QueryClientProvider client={qc}><ThreadView threadId="th1" conversation={team} onGone={onGone} /></QueryClientProvider>)
  openMenu('hey coach')
  fireEvent.click(screen.getByRole('menuitem', { name: 'Block Jordan Lee' }))
  fireEvent.click(screen.getByRole('button', { name: 'Block' }))
  await vi.waitFor(() => expect(onGone).toHaveBeenCalled())
  const keys = invalidate.mock.calls.map((c) => (c[0] as any).queryKey[0])
  expect(keys).toEqual(expect.arrayContaining(['roster', 'unread', 'conversations', 'blocked']))
})

test('a rejected send keeps the draft and says why', () => {
  const { send } = setup()
  send.mutate.mockImplementation((_v: unknown, opts?: { onError?: (e: Error) => void }) =>
    opts?.onError?.(new Error("message contains language that isn't allowed")))
  wrap(<ThreadView threadId="th1" conversation={team} />)
  fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'great run' } })
  fireEvent.click(screen.getByRole('button', { name: /send message/i }))
  expect(screen.getByLabelText('Message')).toHaveValue('great run')
  expect(screen.getByText(/includes language that isn.t allowed/)).toBeInTheDocument()
})

test('double-clicking the names in the header renames the chat inline (Enter saves, Escape cancels)', () => {
  setup()
  const rename = { mutate: vi.fn(), isPending: false }
  vi.spyOn(convMod, 'useRenameConversation').mockReturnValue(rename as any)
  wrap(<ThreadView threadId="th1" conversation={team} />)
  fireEvent.doubleClick(screen.getByRole('heading', { name: 'Jordan Lee' }))
  const box = screen.getByLabelText('Chat name')
  fireEvent.keyDown(box, { key: 'Escape' })
  expect(screen.queryByLabelText('Chat name')).toBeNull()
  expect(rename.mutate).not.toHaveBeenCalled()
  fireEvent.doubleClick(screen.getByRole('heading', { name: 'Jordan Lee' }))
  fireEvent.change(screen.getByLabelText('Chat name'), { target: { value: 'Marathon squad' } })
  fireEvent.keyDown(screen.getByLabelText('Chat name'), { key: 'Enter' })
  expect(rename.mutate).toHaveBeenCalledWith({ threadId: 'th1', title: 'Marathon squad' }, expect.anything())
})

test('a 1:1 or read-only thread cannot be renamed from the header', () => {
  setup()
  wrap(<ThreadView threadId="th1" conversation={{ ...team, read_only: true }} />)
  fireEvent.doubleClick(screen.getByRole('heading', { name: 'Jordan Lee' }))
  expect(screen.queryByLabelText('Chat name')).toBeNull()
})

test('read-only: no Reply, but existing reactions still show (view-only)', () => {
  setup()
  wrap(<ThreadView threadId="th1" conversation={{ ...team, read_only: true }} />)
  openMenu('hey coach')
  expect(screen.queryByRole('menuitem', { name: 'Reply' })).toBeNull()
  expect(screen.getByRole('menuitem', { name: 'Copy' })).toBeInTheDocument()
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
  expect(screen.getByLabelText('Like, 1: You')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /^Like/ })).toBeNull()
})

test('pasting a video stages it with its length; Send uploads it with the caption', async () => {
  setup()
  vi.spyOn(chat, 'useSendImages').mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
  const sendVideo = { mutate: vi.fn(), isPending: false }
  vi.spyOn(chat, 'useSendVideo').mockReturnValue(sendVideo as any)
  vi.spyOn(videoFile, 'checkVideo').mockResolvedValue({ ok: true, duration: 30, w: 720, h: 1280 })
  vi.spyOn(videoFile, 'posterFrame').mockResolvedValue(null)
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:preview'), revokeObjectURL: vi.fn() })
  wrap(<ThreadView threadId="th1" conversation={team} />)
  const box = screen.getByLabelText('Message')
  const clip = new File(['x'], 'clip.mp4', { type: 'video/mp4' })
  fireEvent.paste(box, { clipboardData: { files: [clip], getData: () => '' } })
  expect(await screen.findByText('0:30')).toBeInTheDocument()
  expect(screen.getByText(/Video attached/)).toBeInTheDocument()
  fireEvent.change(box, { target: { value: 'form check' } })
  fireEvent.click(screen.getByRole('button', { name: /send message/i }))
  expect(sendVideo.mutate).toHaveBeenCalledWith(
    { video: { file: clip, duration: 30, w: 720, h: 1280, poster: null }, body: 'form check', replyToId: null }, expect.anything())
})

test('a video over the limit is refused and nothing is staged', async () => {
  setup()
  vi.spyOn(chat, 'useSendImages').mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
  vi.spyOn(chat, 'useSendVideo').mockReturnValue({ mutate: vi.fn(), isPending: false } as any)
  vi.spyOn(videoFile, 'checkVideo').mockResolvedValue({ ok: false, error: 'Videos can be up to 60 seconds and 50 MB.' })
  wrap(<ThreadView threadId="th1" conversation={team} />)
  fireEvent.paste(screen.getByLabelText('Message'), { clipboardData: { files: [new File(['x'], 'long.mp4', { type: 'video/mp4' })], getData: () => '' } })
  expect(await screen.findByText('Videos can be up to 60 seconds and 50 MB.')).toBeInTheDocument()
  expect(screen.queryByText(/Video attached/)).toBeNull()
})

const fileDrag = (type: string, files: File[] = []) => {
  const e = new Event(type, { bubbles: true, cancelable: true }) as any
  e.dataTransfer = { types: ['Files'], files }
  return e
}

test('dragging a file anywhere shows where to drop it; dropping anywhere attaches to this chat', async () => {
  setup()
  wrap(<ThreadView threadId="th1" conversation={team} />)
  expect(screen.queryByText('Drop to attach')).toBeNull()
  act(() => { window.dispatchEvent(fileDrag('dragenter')) })
  expect(screen.getByText('Drop to attach')).toBeInTheDocument()
  expect(screen.getByText('Photos, or one video up to 60 seconds')).toBeInTheDocument()
  // dropped outside the thread itself (e.g. over the chat list): still attaches, never navigates
  const drop = fileDrag('drop', [new File(['x'], 'shot.png', { type: 'image/png' })])
  act(() => { document.body.dispatchEvent(drop) })
  expect(drop.defaultPrevented).toBe(true)
  expect(screen.queryByText('Drop to attach')).toBeNull()
  expect(await screen.findByAltText('Attached photo 1')).toBeInTheDocument()
})

test('a drag that leaves the window hides the drop hint', () => {
  setup()
  wrap(<ThreadView threadId="th1" conversation={team} />)
  act(() => { window.dispatchEvent(fileDrag('dragenter')) })
  act(() => { window.dispatchEvent(fileDrag('dragleave')) })
  expect(screen.queryByText('Drop to attach')).toBeNull()
})

test('dropping a file it cannot attach says what it can', () => {
  setup()
  wrap(<ThreadView threadId="th1" conversation={team} />)
  act(() => { document.body.dispatchEvent(fileDrag('drop', [new File(['x'], 'plan.pdf', { type: 'application/pdf' })])) })
  expect(screen.getByText('You can attach photos, or an MP4 or MOV video.')).toBeInTheDocument()
})

test('a read-only chat shows no drop hint', () => {
  setup()
  wrap(<ThreadView threadId="th1" conversation={{ ...team, read_only: true }} />)
  act(() => { window.dispatchEvent(fileDrag('dragenter')) })
  expect(screen.queryByText('Drop to attach')).toBeNull()
})
