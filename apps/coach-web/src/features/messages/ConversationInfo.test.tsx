import { render, screen } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import * as convMod from '../../lib/queries/conversations'
import { ConversationInfo } from './ConversationInfo'

const m = (user_id: string, name: string) => ({ user_id, name, initials: 'X', avatar_url: null })
const conv = (members: any[], extra: object = {}) => ({ thread_id: 't1', kind: 'chat', title: null, team_athlete_id: null, members,
  last_body: null, last_kind: null, last_from: null, last_at: null, unread: 0, read_only: false, ...extra }) as any
const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

beforeEach(() => {
  for (const h of ['useRenameConversation', 'useAddMembers', 'useLeaveConversation', 'useHideConversation'] as const)
    vi.spyOn(convMod, h).mockReturnValue({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false } as any)
  vi.spyOn(convMod, 'useSearchPeople').mockReturnValue({ data: [] } as any)
})

test('a 1:1 offers Hide, not Leave or rename', () => {
  wrap(<ConversationInfo conversation={conv([m('a1', 'Maya Chen')])} onClose={() => {}} onOpenThread={() => {}} />)
  expect(screen.getByRole('button', { name: 'Hide conversation' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Leave conversation' })).toBeNull()
  expect(screen.queryByLabelText('Group name')).toBeNull()
})

test('a group lists members and offers rename and Leave', () => {
  wrap(<ConversationInfo conversation={conv([m('a1', 'Maya Chen'), m('c2', 'Marcus Hale')], { title: 'Crew' })} onClose={() => {}} onOpenThread={() => {}} />)
  expect(screen.getByText('Maya Chen')).toBeInTheDocument()
  expect(screen.getByLabelText('Group name')).toHaveValue('Crew')
  expect(screen.getByRole('button', { name: 'Leave conversation' })).toBeInTheDocument()
})

test('a read-only conversation says so and offers no edits', () => {
  wrap(<ConversationInfo conversation={conv([m('a1', 'Maya Chen')], { read_only: true })} onClose={() => {}} onOpenThread={() => {}} />)
  expect(screen.getByText('This conversation is read-only.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Add people' })).toBeNull()
})

test('a team chat can be renamed by its members, but has no add, leave, or hide', async () => {
  const { fireEvent } = await import('@testing-library/react')
  const rename = { mutate: vi.fn(), isPending: false }
  vi.spyOn(convMod, 'useRenameConversation').mockReturnValue(rename as any)
  wrap(<ConversationInfo conversation={conv([m('a1', 'Maya Chen')], { kind: 'team', team_athlete_id: 'a1' })} onClose={() => {}} onOpenThread={() => {}} />)
  fireEvent.change(screen.getByLabelText('Group name'), { target: { value: 'Marathon squad' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(rename.mutate).toHaveBeenCalledWith({ threadId: 't1', title: 'Marathon squad' }, expect.anything())
  expect(screen.queryByRole('button', { name: /Leave|Hide|Add people/ })).toBeNull()
})
