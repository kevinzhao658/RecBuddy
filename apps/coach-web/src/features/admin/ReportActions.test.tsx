import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ReportActions } from './ReportActions'
import * as admin from '../../lib/queries/admin'

const report = (o: Partial<admin.AdminReport> = {}): admin.AdminReport => ({
  id: 'r1', reason: 'harassment', details: null, status: 'open', created_at: new Date().toISOString(),
  resolved_at: null, resolution_note: null, message_id: 'm1', content_snapshot: { kind: 'text', body: 'x' },
  reporter_id: 'u1', reporter_name: 'Maya Chen', reporter_email: null,
  reported_user_id: 'u2', reported_name: 'Marcus Hale', reported_email: null,
  reported_suspended_at: null, reported_open_reports: 1, actions_taken: [], starred: false, read_at: null, ...o,
})

let act: ReturnType<typeof vi.fn>, resolve: ReturnType<typeof vi.fn>
beforeEach(() => {
  act = vi.fn().mockResolvedValue(undefined)
  resolve = vi.fn().mockResolvedValue(undefined)
  vi.spyOn(admin, 'useAdminAction').mockReturnValue({ mutateAsync: act } as any)
  vi.spyOn(admin, 'useResolveReport').mockReturnValue({ mutateAsync: resolve } as any)
})

const bubble = (name: RegExp) => screen.getByRole('button', { name })
const note = (v: string) => fireEvent.change(screen.getByLabelText(/^Note/), { target: { value: v } })

test('Mark actioned is disabled until an action bubble is picked', () => {
  render(<ReportActions report={report()} />)
  expect(screen.getByRole('button', { name: 'Mark actioned' })).toBeDisabled()
  fireEvent.click(bubble(/Delete message/))
  expect(bubble(/Delete message/)).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Mark actioned' })).toBeEnabled()
})

test('confirming runs the picked actions in order, then marks actioned', async () => {
  render(<ReportActions report={report()} />)
  fireEvent.click(bubble(/Suspend user/))
  fireEvent.click(bubble(/Delete message/))
  fireEvent.click(screen.getByRole('button', { name: 'Mark actioned' }))
  // The confirmation spells out what will happen
  expect(screen.getByText(/Delete the reported message/)).toBeInTheDocument()
  expect(screen.getByText(/Suspend Marcus Hale/)).toBeInTheDocument()
  const go = screen.getByRole('button', { name: 'Confirm and mark actioned' })
  expect(go).toBeEnabled() // the note is optional
  expect(screen.getByLabelText('Note (optional)')).toBeInTheDocument()
  note('slur, repeat offender')
  fireEvent.click(go)
  await waitFor(() => expect(resolve).toHaveBeenCalledWith({ reportId: 'r1', status: 'actioned', note: 'slur, repeat offender' }))
  expect(act.mock.calls.map((c) => c[0].action)).toEqual(['delete_message', 'suspend'])
})

test('suspend and remove are mutually exclusive; remove needs typed REMOVE', async () => {
  render(<ReportActions report={report()} />)
  fireEvent.click(bubble(/Suspend user/))
  fireEvent.click(bubble(/Remove user/))
  expect(bubble(/Suspend user/)).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(screen.getByRole('button', { name: 'Mark actioned' }))
  note('threats')
  const go = screen.getByRole('button', { name: 'Confirm and mark actioned' })
  expect(go).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Type REMOVE to confirm'), { target: { value: 'remove' } })
  fireEvent.click(go)
  await waitFor(() => expect(act).toHaveBeenCalledWith({ action: 'delete_user', user_id: 'u2', report_id: 'r1', note: 'threats' }))
})

test('a failed step keeps the report open and says which step failed', async () => {
  act.mockRejectedValueOnce(new Error('network down'))
  render(<ReportActions report={report()} />)
  fireEvent.click(bubble(/Delete message/))
  fireEvent.click(screen.getByRole('button', { name: 'Mark actioned' }))
  note('x')
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and mark actioned' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/Deleted message failed: network down/)
  expect(resolve).not.toHaveBeenCalled()
})

test('dismiss closes with a note and no actions', async () => {
  render(<ReportActions report={report()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss, no violation' }))
  note('no violation')
  fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
  await waitFor(() => expect(resolve).toHaveBeenCalledWith({ reportId: 'r1', status: 'dismissed', note: 'no violation' }))
  expect(act).not.toHaveBeenCalled()
})

test('a closed report offers only Reopen', async () => {
  render(<ReportActions report={report({ status: 'actioned', actions_taken: ['suspend'] })} />)
  expect(screen.getAllByRole('button').map((b) => b.textContent)).toEqual(['Reopen'])
  fireEvent.click(screen.getByRole('button', { name: 'Reopen' }))
  note('appeal')
  fireEvent.click(screen.getAllByRole('button', { name: 'Reopen' }).at(-1)!)
  await waitFor(() => expect(resolve).toHaveBeenCalledWith({ reportId: 'r1', status: 'open', note: 'appeal' }))
})

test('a suspended user offers Lift suspension instead of Suspend', () => {
  render(<ReportActions report={report({ reported_suspended_at: '2026-10-18T00:00:00Z' })} />)
  expect(bubble(/Lift suspension/)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Suspend user/ })).not.toBeInTheDocument()
})

test('confirming without a note works (note is optional)', async () => {
  render(<ReportActions report={report()} />)
  fireEvent.click(bubble(/Delete message/))
  fireEvent.click(screen.getByRole('button', { name: 'Mark actioned' }))
  fireEvent.click(screen.getByRole('button', { name: 'Confirm and mark actioned' }))
  await waitFor(() => expect(resolve).toHaveBeenCalledWith({ reportId: 'r1', status: 'actioned', note: '' }))
})
