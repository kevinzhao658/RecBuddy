import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { SettingsModal } from './SettingsModal'
import { UnitProvider } from '../../lib/useUnit'
import * as meMod from '../../lib/queries/me'

function wrap(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <UnitProvider>{ui}</UnitProvider>
    </QueryClientProvider>,
  )
}

test('shows profile/units/email/password and saves profile edits', () => {
  const update = { mutate: vi.fn(), isPending: false }
  vi.spyOn(meMod, 'useMe').mockReturnValue({ data: { name: 'Mara Whitlock', title: 'Head Coach', email: 'mara@recbuddy.app', initials: 'MW' }, isLoading: false } as any)
  vi.spyOn(meMod, 'useUpdateProfile').mockReturnValue(update as any)

  wrap(<SettingsModal open={true} onClose={() => {}} />)
  expect(screen.getByText('Settings')).toBeInTheDocument()
  expect(screen.getByLabelText('Name')).toHaveValue('Mara Whitlock')
  expect(screen.getByLabelText('Email')).toHaveValue('mara@recbuddy.app')
  expect(screen.getByRole('button', { name: /miles/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /kilometers/i })).toBeInTheDocument()
  expect(screen.getByLabelText('New password')).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Mara W' } })
  fireEvent.click(screen.getByRole('button', { name: /save profile/i }))
  expect(update.mutate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Mara W' }), expect.anything())
})
