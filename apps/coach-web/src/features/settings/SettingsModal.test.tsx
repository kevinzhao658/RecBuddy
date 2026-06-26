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

function mockMe(data: Record<string, unknown>) {
  const update = { mutate: vi.fn(), isPending: false }
  const upload = { mutate: vi.fn(), isPending: false }
  vi.spyOn(meMod, 'useMe').mockReturnValue({ data, isLoading: false } as any)
  vi.spyOn(meMod, 'useUpdateProfile').mockReturnValue(update as any)
  vi.spyOn(meMod, 'useUploadAvatar').mockReturnValue(upload as any)
  return { update, upload }
}

test('shows profile/units/email/password and saves profile edits', () => {
  const { update } = mockMe({ name: 'Mara Whitlock', title: 'Head Coach', email: 'mara@recbuddy.app', initials: 'MW' })

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

test('uploads a chosen photo and offers removal only when one exists', () => {
  const { update, upload } = mockMe({ name: 'Mara Whitlock', title: 'Head Coach', email: 'mara@recbuddy.app', initials: 'MW', avatar_url: 'https://x/avatar?v=1' })
  wrap(<SettingsModal open={true} onClose={() => {}} />)

  const file = new File(['x'], 'me.png', { type: 'image/png' })
  fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [file] } })
  expect(upload.mutate).toHaveBeenCalledWith(file, expect.anything())

  fireEvent.click(screen.getByRole('button', { name: /remove/i }))
  expect(update.mutate).toHaveBeenCalledWith({ avatar_url: null }, expect.anything())
})

test('rejects non-image files without uploading', () => {
  const { upload } = mockMe({ name: 'Mara Whitlock', title: 'Head Coach', email: 'mara@recbuddy.app', initials: 'MW', avatar_url: null })
  wrap(<SettingsModal open={true} onClose={() => {}} />)

  const pdf = new File(['x'], 'doc.pdf', { type: 'application/pdf' })
  fireEvent.change(screen.getByLabelText('Upload photo'), { target: { files: [pdf] } })
  expect(upload.mutate).not.toHaveBeenCalled()
  expect(screen.getByText(/choose an image file/i)).toBeInTheDocument()
})
