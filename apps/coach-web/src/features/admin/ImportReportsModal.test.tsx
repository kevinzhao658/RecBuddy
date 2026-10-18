import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ImportReportsModal } from './ImportReportsModal'
import * as admin from '../../lib/queries/admin'
import { reportsToCsv } from '../../lib/reportCsv'
import { parseCsv, toCsv } from '../../lib/csv'

const report = (o: Partial<admin.AdminReport> = {}): admin.AdminReport => ({
  id: 'r1', reason: 'harassment', details: null, status: 'open', created_at: '2026-10-18T10:00:00Z',
  resolved_at: null, resolution_note: null, message_id: 'm1', content_snapshot: { kind: 'text', body: 'x' },
  reporter_id: 'u1', reporter_name: 'Maya Chen', reporter_email: null,
  reported_user_id: 'u2', reported_name: 'Marcus Hale', reported_email: null,
  reported_suspended_at: null, reported_open_reports: 1, actions_taken: [], starred: false, read_at: null, ...o,
})

function csvWith(reports: admin.AdminReport[], edits: Record<string, [string, string, string]>) {
  const rows = parseCsv(reportsToCsv(reports))
  const n = rows[0].length
  for (const r of rows.slice(1)) { const e = edits[r[0]]; if (e) [r[n - 3], r[n - 2], r[n - 1]] = e }
  return new File([toCsv(rows)], 'edited.csv', { type: 'text/csv' })
}

function open(reports: admin.AdminReport[]) {
  vi.spyOn(admin, 'fetchAllReports').mockResolvedValue(reports)
  const apply = vi.spyOn(admin, 'applyReportChange').mockResolvedValue(undefined)
  render(<QueryClientProvider client={new QueryClient()}><ImportReportsModal open onClose={() => {}} /></QueryClientProvider>)
  return apply
}

test('previews valid and invalid rows, then applies only the valid ones', async () => {
  const rs = [report(), report({ id: 'r2', reported_name: 'Spam Bot' })]
  const apply = open(rs)
  fireEvent.change(screen.getByLabelText('Choose CSV file'), {
    target: { files: [csvWith(rs, { r1: ['actioned', 'delete_message', 'slur'], r2: ['actioned', '', ''] })] },
  })
  await screen.findByRole('table', { name: 'Import preview' })
  expect(screen.getByText('Ready')).toBeInTheDocument()
  expect(screen.getByText(/needs an action/)).toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: 'Apply 1 change' }))
  await waitFor(() => expect(apply).toHaveBeenCalledTimes(1))
  expect(apply).toHaveBeenCalledWith({ reportId: 'r1', action: 'delete_message', newStatus: 'actioned', note: 'slur', messageId: 'm1', userId: 'u2' })
  expect(await screen.findByText('Applied')).toBeInTheDocument()
})

test('removing users requires typing REMOVE', async () => {
  const rs = [report()]
  open(rs)
  fireEvent.change(screen.getByLabelText('Choose CSV file'), { target: { files: [csvWith(rs, { r1: ['actioned', 'delete_user', 'threats'] })] } })
  const applyBtn = await screen.findByRole('button', { name: 'Apply 1 change' })
  expect(applyBtn).toBeDisabled()
  fireEvent.change(screen.getByLabelText('Type REMOVE to confirm'), { target: { value: 'remove' } })
  expect(applyBtn).toBeEnabled()
})

test('a file with the wrong columns is rejected up front', async () => {
  open([report()])
  fireEvent.change(screen.getByLabelText('Choose CSV file'), { target: { files: [new File(['id,foo\n1,2\n'], 'x.csv')] } })
  expect(await screen.findByText(/Missing columns/)).toBeInTheDocument()
})
