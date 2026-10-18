import { render, screen, fireEvent } from '@testing-library/react'
import { ReportFilters } from './ReportFilters'
import type { ReportFilter } from '../../lib/adminFormat'

function setup(value: ReportFilter = {}, showOverdue = true) {
  const onChange = vi.fn()
  render(<ReportFilters value={value} onChange={onChange} showOverdue={showOverdue} />)
  return onChange
}

test('sort menu shows the current choice with a check and closes on pick', () => {
  const onChange = setup({ sort: 'oldest' })
  fireEvent.click(screen.getByRole('button', { name: 'Sort reports' }))
  expect(screen.getByRole('menuitemradio', { name: 'Oldest first' })).toHaveAttribute('aria-checked', 'true')
  fireEvent.click(screen.getByRole('menuitemradio', { name: 'Most-reported users' }))
  expect(onChange).toHaveBeenCalledWith({ sort: 'most_reported' })
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})

test('active filters show as removable tokens and a count', () => {
  const onChange = setup({ reason: 'hate', starredOnly: true })
  expect(screen.getByRole('list', { name: 'Active filters' })).toHaveTextContent('Hate speech or slurs')
  expect(screen.getByRole('button', { name: 'Filter reports by' })).toHaveTextContent('2')
  fireEvent.click(screen.getByRole('button', { name: 'Remove filter: Hate speech or slurs' }))
  expect(onChange).toHaveBeenCalledWith({ reason: undefined, starredOnly: true })
})

test('filter menu toggles show-only options; Escape closes it', () => {
  const onChange = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Filter reports by' }))
  fireEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Unread' }))
  expect(onChange).toHaveBeenCalledWith({ unreadOnly: true })
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
})

test('over-24h option only on the open tab', () => {
  setup({}, false)
  fireEvent.click(screen.getByRole('button', { name: 'Filter reports by' }))
  expect(screen.queryByRole('menuitemcheckbox', { name: /24 hours/ })).not.toBeInTheDocument()
})
