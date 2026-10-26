import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import * as mod from '../../lib/queries/moderation'
import { ReportDialog } from './ReportDialog'

const wrap = (ui: React.ReactNode) => render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)

test('needs a reason, then reports the message (and blocks when asked)', async () => {
  const report = vi.spyOn(mod, 'reportContent').mockResolvedValue(undefined)
  const block = vi.spyOn(mod, 'blockUser').mockResolvedValue(undefined)
  const onDone = vi.fn()
  wrap(<ReportDialog open target={{ userId: 'u2', userName: 'Jordan Lee', messageId: 'm1' }} onClose={() => {}} onDone={onDone} />)
  const submit = screen.getByRole('button', { name: 'Submit report' })
  expect(submit).toBeDisabled()
  fireEvent.click(screen.getByLabelText('Harassment or bullying'))
  fireEvent.change(screen.getByLabelText('Details (optional)'), { target: { value: 'rude' } })
  fireEvent.click(screen.getByLabelText('Also block Jordan Lee'))
  fireEvent.click(submit)
  await waitFor(() => expect(onDone).toHaveBeenCalledWith(true))
  expect(report).toHaveBeenCalledWith(expect.anything(), { reason: 'harassment', messageId: 'm1', userId: 'u2', details: 'rude' })
  expect(block).toHaveBeenCalledWith(expect.anything(), 'u2')
  expect(screen.getByText(/review your report within 24 hours/)).toBeInTheDocument()
})
