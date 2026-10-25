import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from './ConfirmDialog'

test('a short title to read at a glance, with the detail underneath in plain text', () => {
  render(<ConfirmDialog open title="Remove Maya Chen?" detail="Anyone here can add them back." onConfirm={() => {}} onCancel={() => {}} />)
  const dialog = screen.getByRole('alertdialog', { name: 'Remove Maya Chen?' })
  expect(dialog).toHaveAccessibleDescription('Anyone here can add them back.')
  expect(screen.getByRole('heading', { name: 'Remove Maya Chen?' })).toBeInTheDocument()
  expect(screen.getByText('Anyone here can add them back.').className).not.toMatch(/font-bold|font-display/)
})

test('a destructive confirm is red, shows its icon, and runs on click', () => {
  const onConfirm = vi.fn()
  render(<ConfirmDialog open danger icon="block" title="Block Jordan Lee?" confirmLabel="Block" onConfirm={onConfirm} onCancel={() => {}} />)
  const block = screen.getByRole('button', { name: 'Block' })
  expect(block.className).toMatch(/bg-missed/)
  expect(screen.getByTestId('confirm-icon')).toBeInTheDocument()
  fireEvent.click(block)
  expect(onConfirm).toHaveBeenCalled()
})
