import { StrictMode } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { StagedVideoTile } from './StagedVideoTile'

test('the preview keeps a live video address (strict mode mounts twice)', () => {
  let n = 0
  const revoked = new Set<string>()
  Object.assign(URL, { createObjectURL: vi.fn(() => `blob:${++n}`), revokeObjectURL: vi.fn((u: string) => revoked.add(u)) })
  const video = { file: new File(['x'], 'c.mp4', { type: 'video/mp4' }), duration: 3, w: 360, h: 640, poster: null }
  const { unmount } = render(<StrictMode><StagedVideoTile video={video} onRemove={() => {}} /></StrictMode>)
  fireEvent.click(screen.getByRole('button', { name: 'Preview video' }))
  const src = screen.getByTestId('staged-preview').getAttribute('src')!
  expect(revoked.has(src)).toBe(false)
  unmount()
  expect(revoked.has(src)).toBe(true)     // and it's freed when the tile goes
})
