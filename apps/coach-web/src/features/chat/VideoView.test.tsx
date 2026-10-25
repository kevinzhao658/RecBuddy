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

test('shows the poster, a play button and the length; bytes load only on play', async () => {
  vi.spyOn(store, 'hasVideo').mockResolvedValue(true)
  const get = vi.spyOn(store, 'getVideo').mockResolvedValue(new Blob(['v'], { type: 'video/mp4' }))
  const download = vi.spyOn(chat, 'downloadVideo')
  wrap(<VideoView messageId="m1" p={p} expiresAt={later} purgedAt={null} />)
  expect(screen.getByText('0:42')).toBeInTheDocument()
  await waitFor(() => expect(store.hasVideo).toHaveBeenCalledWith('m1'))
  expect(get).not.toHaveBeenCalled()
  expect(screen.getByRole('img', { name: /video/i })).toHaveAttribute('src', 'https://x/poster.jpg')
  fireEvent.click(await screen.findByRole('button', { name: /play video/i }))
  const player = await screen.findByTestId('video-player')
  expect(player).toHaveAttribute('controls')
  expect(player).toHaveAttribute('src', 'blob:clip')
  expect(download).not.toHaveBeenCalled()
})

test('plays right in the bubble, not a pop-up; full screen keeps the whole frame', async () => {
  vi.spyOn(store, 'hasVideo').mockResolvedValue(true)
  vi.spyOn(store, 'getVideo').mockResolvedValue(new Blob(['v'], { type: 'video/mp4' }))
  wrap(<VideoView messageId="m5" p={p} expiresAt={later} purgedAt={null} />)
  fireEvent.click(await screen.findByRole('button', { name: /play video/i }))
  const player = await screen.findByTestId('video-player')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(player.closest('[data-testid="video-bubble"]')).not.toBeNull()
  expect(player).toHaveAttribute('autoplay')
  expect(player).toHaveAttribute('playsinline')
  // fits the frame (letterboxed) rather than zooming to fill, inline and in full screen
  expect(player.className).toMatch(/object-contain/)
  expect(player.className).not.toMatch(/object-cover/)
  expect(player.className).toMatch(/\[&:fullscreen\]:object-contain/)
  expect(screen.queryByRole('button', { name: /play video/i })).toBeNull()
})

test('an expired clip with no copy here says so, has no play button, and is not fetched', async () => {
  vi.spyOn(store, 'hasVideo').mockResolvedValue(false)
  const download = vi.spyOn(chat, 'downloadVideo')
  wrap(<VideoView messageId="m2" p={p} expiresAt={past} purgedAt={past} />)
  expect(await screen.findByText('Video expired')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /play video/i })).toBeNull()
  expect(download).not.toHaveBeenCalled()
})

test('a clip not on this device yet downloads and is kept, with an expiry note until then', async () => {
  vi.spyOn(store, 'hasVideo').mockResolvedValue(false)
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

test('play before the download lands fetches it then plays; a failed download can be retried', async () => {
  vi.spyOn(store, 'hasVideo').mockResolvedValue(false)
  const blob = new Blob(['v'], { type: 'video/mp4' })
  const download = vi.spyOn(chat, 'downloadVideo')
    .mockRejectedValueOnce(new Error('offline'))   // the automatic download
    .mockRejectedValueOnce(new Error('offline'))   // first tap
    .mockResolvedValueOnce(blob)                   // retry
  wrap(<VideoView messageId="m4" p={p} expiresAt={later} purgedAt={null} />)
  await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole('button', { name: /play video/i }))
  expect(await screen.findByText(/Couldn.t load the video/)).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /play video/i }))
  expect(await screen.findByTestId('video-player')).toHaveAttribute('src', 'blob:clip')
  expect(store.putVideo).toHaveBeenCalledWith('m4', blob)
})
