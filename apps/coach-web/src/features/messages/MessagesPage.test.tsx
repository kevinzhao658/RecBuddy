import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import * as convMod from '../../lib/queries/conversations'
import * as authMod from '../../auth/AuthProvider'
import * as threadMod from './ThreadView'
import * as sidebarMod from '../roster/RosterSidebar'
import { MessagesPage } from './MessagesPage'

const row = (id: string, kind: string, extra: object = {}) => ({
  thread_id: id, kind, title: null, team_athlete_id: kind === 'team' ? 'ath' : null,
  members: [{ user_id: kind === 'team' ? 'ath' : 'u2', name: kind === 'team' ? 'Maya Chen' : 'Marcus Hale', initials: 'X', avatar_url: null }],
  last_body: 'hello', last_kind: 'text', last_from: 'u2', last_at: '2026-10-21T14:00:00Z', unread: 0, read_only: false, ...extra,
})

function setup(rows: any[]) {
  vi.spyOn(authMod, 'useAuth').mockReturnValue({ session: { user: { id: 'me' } } } as any)
  vi.spyOn(convMod, 'useConversations').mockReturnValue({ data: rows, isLoading: false } as any)
  vi.spyOn(threadMod, 'ThreadView').mockImplementation(((p: any) => <div>thread:{p.threadId}</div>) as any)
  vi.spyOn(sidebarMod, 'RosterSidebar').mockImplementation((() => <nav>sidebar</nav>) as any)
}

function renderAt(path: string) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/coach/messages" element={<MessagesPage />} />
          <Route path="/coach/messages/:threadId" element={<MessagesPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>)
}

test('lists conversations in inbox order with titles, previews, and unread', () => {
  setup([row('t1', 'team'), row('t2', 'chat', { unread: 2 })])
  renderAt('/coach/messages')
  const items = screen.getAllByRole('button', { name: /Maya Chen|Marcus Hale/ })
  expect(items.map((b) => b.getAttribute('aria-label'))).toEqual(['Maya Chen, team chat', 'Marcus Hale, 2 unread'])
  // Team chats carry a small "Team" pill on the avatar instead of a title suffix.
  expect(screen.getAllByText('Team')).toHaveLength(1)
  expect(screen.getByText('Select a conversation')).toBeInTheDocument()
})

test('clicking a row opens that thread', () => {
  setup([row('t1', 'team'), row('t2', 'chat')])
  renderAt('/coach/messages')
  fireEvent.click(screen.getByRole('button', { name: 'Marcus Hale' }))
  expect(screen.getByText('thread:t2')).toBeInTheDocument()
})

test('a thread id in the URL opens directly, and new rows appear when the inbox updates', () => {
  setup([row('t1', 'team')])
  const view = renderAt('/coach/messages/t1')
  expect(screen.getByText('thread:t1')).toBeInTheDocument()
  vi.spyOn(convMod, 'useConversations').mockReturnValue({ data: [row('t3', 'chat'), row('t1', 'team')], isLoading: false } as any)
  view.rerender(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={['/coach/messages/t1']}>
        <Routes><Route path="/coach/messages/:threadId" element={<MessagesPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>)
  expect(screen.getByRole('button', { name: 'Marcus Hale' })).toBeInTheDocument()
})

test('phone: the inbox header has a hamburger that opens the roster drawer', () => {
  setup([row('t1', 'team')])
  renderAt('/coach/messages')
  expect(screen.getAllByText('sidebar')).toHaveLength(1)        // desktop column only
  fireEvent.click(screen.getByRole('button', { name: 'Open roster' }))
  expect(screen.getAllByText('sidebar')).toHaveLength(2)        // + the phone drawer
})

test('phone: an open thread has a back button to the inbox', () => {
  setup([row('t1', 'team')])
  vi.spyOn(threadMod, 'ThreadView').mockImplementation(((p: any) => <button onClick={p.onBack}>back</button>) as any)
  renderAt('/coach/messages/t1')
  fireEvent.click(screen.getByRole('button', { name: 'back' }))
  expect(screen.getByText('Select a conversation')).toBeInTheDocument()
})
