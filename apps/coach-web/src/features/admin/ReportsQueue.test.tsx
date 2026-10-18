import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReportsQueue } from './ReportsQueue'
import * as admin from '../../lib/queries/admin'

const report = (over: Partial<admin.AdminReport> = {}): admin.AdminReport => ({
  id: 'r1', reason: 'harassment', details: 'keeps doing it', status: 'open',
  created_at: new Date().toISOString(), resolved_at: null, resolution_note: null,
  message_id: 'm1', content_snapshot: { kind: 'text', body: 'rude thing', thread_id: 't1', sent_at: new Date().toISOString() },
  reporter_id: 'u1', reporter_name: 'Maya Chen', reporter_email: 'maya@x.app',
  reported_user_id: 'u2', reported_name: 'Marcus Hale', reported_email: 'marcus@x.app',
  reported_suspended_at: null, reported_open_reports: 1, actions_taken: [], starred: false, read_at: null, ...over,
})

let resolve: ReturnType<typeof vi.fn>
let act: ReturnType<typeof vi.fn>

let mark: ReturnType<typeof vi.fn>

function setup(rows: admin.AdminReport[], url = '/admin/reports?id=r1') {
  vi.spyOn(admin, 'useAdminReports').mockReturnValue({ data: rows, isLoading: false, error: null } as any)
  vi.spyOn(admin, 'useReportContext').mockReturnValue({ data: [
    { id: 'm0', from_user_id: 'u1', sender_name: 'Maya Chen', kind: 'text', body: 'before', payload: null, created_at: new Date().toISOString(), is_reported: false },
    { id: 'm1', from_user_id: 'u2', sender_name: 'Marcus Hale', kind: 'text', body: 'rude thing', payload: null, created_at: new Date().toISOString(), is_reported: true },
  ], isLoading: false } as any)
  resolve = vi.fn().mockResolvedValue(undefined)
  act = vi.fn().mockResolvedValue(undefined)
  vi.spyOn(admin, 'useResolveReport').mockReturnValue({ mutateAsync: resolve } as any)
  vi.spyOn(admin, 'useAdminAction').mockReturnValue({ mutateAsync: act } as any)
  mark = vi.fn()
  vi.spyOn(admin, 'useMarkReport').mockReturnValue({ mutate: mark } as any)
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[url]}><ReportsQueue /></MemoryRouter></QueryClientProvider>)
}

test('shows the report, both parties, the content and its conversation', () => {
  setup([report()])
  expect(screen.getByRole('heading', { name: 'Harassment or bullying' })).toBeInTheDocument()
  expect(screen.getAllByText('Marcus Hale').length).toBeGreaterThan(0)
  // Conversation is collapsed until opened
  expect(screen.queryByRole('list', { name: 'Conversation context' })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Conversation \(2 messages\)/ }))
  expect(screen.getByRole('list', { name: 'Conversation context' })).toHaveTextContent('before')
  expect(screen.getAllByText('rude thing').length).toBe(2) // quote + highlighted context row
})

test('flags open reports older than 24 hours', () => {
  setup([report({ created_at: new Date(Date.now() - 30 * 3_600_000).toISOString() })])
  expect(screen.getAllByText('Over 24h').length).toBeGreaterThan(0)
})



test('a deleted message hides the delete action and says it is a saved copy', () => {
  setup([report({ message_id: null })])
  expect(screen.queryByRole('button', { name: /Delete message/ })).not.toBeInTheDocument()
  expect(screen.getByText(/saved copy/)).toBeInTheDocument()
})

test('empty open queue', () => {
  setup([], '/admin/reports')
  expect(screen.getByText('No open reports. Nice.')).toBeInTheDocument()
})




test('filters narrow the list and say how many are shown', () => {
  setup([report(), report({ id: 'r2', reason: 'spam', reported_name: 'Spam Bot' })])
  fireEvent.click(screen.getByRole('button', { name: 'Filter reports by' }))
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Spam or scam' }))
  expect(screen.getByText('Showing 1 of 2')).toBeInTheDocument()
  expect(screen.getByRole('list', { name: 'Reports' })).toHaveTextContent('Spam Bot')
  expect(screen.getByRole('list', { name: 'Reports' })).not.toHaveTextContent('Marcus Hale')
})

test('nothing opens until a report is picked; opening marks it read', () => {
  setup([report()], '/admin/reports')
  expect(screen.getByText(/Pick a report to review it/)).toBeInTheDocument()
  expect(mark).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: /Harassment or bullying, Marcus Hale, unread/ }))
  expect(mark).toHaveBeenCalledWith({ reportId: 'r1', read: true })
})

test('read reports are faded; unread are not', () => {
  setup([report({ id: 'r2', read_at: '2026-10-18T12:00:00Z' }), report({ id: 'r3' })], '/admin/reports')
  const items = screen.getAllByRole('listitem')
  expect(items[0].className).toMatch(/opacity-55/)
  expect(items[1].className).not.toMatch(/opacity-55/)
})

test('star toggles from the list and the starred filter narrows it', () => {
  setup([report({ id: 'r2', starred: true, reported_name: 'Starred One' }), report({ id: 'r3', reported_name: 'Plain' })], '/admin/reports')
  fireEvent.click(screen.getAllByRole('button', { name: 'Star report' })[0])
  expect(mark).toHaveBeenCalledWith({ reportId: 'r3', starred: true })
  fireEvent.click(screen.getByRole('button', { name: 'Filter reports by' }))
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Starred' }))
  expect(screen.getByRole('list', { name: 'Reports' })).toHaveTextContent('Starred One')
  expect(screen.getByRole('list', { name: 'Reports' })).not.toHaveTextContent('Plain')
})

test('no matches offers a one-click reset', () => {
  setup([report()], '/admin/reports?reason=spam')
  expect(screen.getByText(/No reports match/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
  expect(screen.getByRole('list', { name: 'Reports' })).toHaveTextContent('Marcus Hale')
})
