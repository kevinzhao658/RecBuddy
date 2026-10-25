import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClientProvider, QueryClient } from '@tanstack/react-query'
import { VideoView } from './VideoView'
import * as chat from '../../lib/queries/chat'
import * as store from '../../lib/videoStore'

const p = { path: 't/v.mp4', poster: 't/p.jpg', w: 720, h: 1280, duration_s: 42 }
const later = new Date(Date.now() + 3 * 86400_000 + 3600_000).toISOString()
const past = new Date(Date.now() - 3600_000).toISOString()

function wrap(ui: React.ReactNode) {
  return render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>)
}

beforeEach(() => {
  vi.spyOn(chat, 'useSignedImageUrl').mockReturnValue({ data: 'https://x/poster.jpg' } as any)
  vi.spyOn(store, 'requestPersistence').mockResolvedValue()
  vi.spyOn(store, 'putVideo').mockResolvedValue()
  Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:clip'), revokeObjectURL: vi.fn() })
})

test('shows the poster, a play button and the length; play opens a player', async () => {
  vi.spyOn(store, 'getVideo').mockResolvedValue(new Blob(['v'], { type: 'video/mp4' }))
  const download = vi.spyOn(chat, 'downloadVideo')
  wrap(<VideoView messageId="m1" p={p} expiresAt={later} purgedAt={null} />)
  expect(screen.getByText('0:42')).toBeInTheDocument()
  expect(screen.getByRole('img', { name: /video/i })).toHaveAttribute('src', 'https://x/poster.jpg')
  fireEvent.click(await screen.findByRole('button', { name: /play video/i }))
  const player = await screen.findByTestId('video-player')
  expect(player).toHaveAttribute('controls')
  expect(player).toHaveAttribute('src', 'blob:clip')
  expect(download).not.toHaveBeenCalled()
})

test('an expired clip with no copy here says so, has no play button, and is not fetched', async () => {
  vi.spyOn(store, 'getVideo').mockResolvedValue(null)
  const download = vi.spyOn(chat, 'downloadVideo')
  wrap(<VideoView messageId="m2" p={p} expiresAt={past} purgedAt={past} />)
  expect(await screen.findByText('Video expired')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /play video/i })).toBeNull()
  expect(download).not.toHaveBeenCalled()
})

test('a clip not on this device yet downloads and is kept, with an expiry note until then', async () => {
  vi.spyOn(store, 'getVideo').mockResolvedValue(null)
  const blob = new Blob(['v'], { type: 'video/mp4' })
  let finish: (b: Blob) => void = () => {}
  const download = vi.spyOn(chat, 'downloadVideo').mockReturnValue(new Promise((r) => { finish = r }))
  wrap(<VideoView messageId="m3" p={p} expiresAt={later} purgedAt={null} />)
  expect(await screen.findByText('Expires in 3 days')).toBeInTheDocument()
  await waitFor(() => expect(download).toHaveBeenCalledWith('t/v.mp4'))
  finish(blob)
  await waitFor(() => expect(store.putVideo).toHaveBeenCalledWith('m3', blob))
  await waitFor(() => expect(screen.queryByText('Expires in 3 days')).toBeNull())
})
