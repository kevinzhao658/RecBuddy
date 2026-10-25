import { checkVideo, isVideoFile } from './videoFile'

const file = (mb: number, type = 'video/mp4') => {
  const f = new File(['x'], 'clip.mp4', { type })
  Object.defineProperty(f, 'size', { value: mb * 1024 * 1024 })
  return f
}
const meta = (duration: number, w = 720, h = 1280) => async () => ({ duration, w, h })
const REFUSAL = 'Videos can be up to 60 seconds and 50 MB.'

test('only mp4 and QuickTime count as videos', () => {
  expect(isVideoFile(file(1))).toBe(true)
  expect(isVideoFile(file(1, 'video/quicktime'))).toBe(true)
  expect(isVideoFile(file(1, 'video/webm'))).toBe(false)
  expect(isVideoFile(file(1, 'image/png'))).toBe(false)
})

test('refuses over 60 seconds or over 50 MB', async () => {
  expect(await checkVideo(file(5), meta(61))).toEqual({ ok: false, error: REFUSAL })
  expect(await checkVideo(file(51), meta(10))).toEqual({ ok: false, error: REFUSAL })
})

test('accepts a 30-second 5 MB clip with its size', async () => {
  expect(await checkVideo(file(5), meta(30))).toEqual({ ok: true, duration: 30, w: 720, h: 1280 })
})

test('an unreadable duration or size still sends', async () => {
  expect(await checkVideo(file(5), meta(Infinity))).toEqual({ ok: true, duration: 0, w: 720, h: 1280 })
  expect(await checkVideo(file(5), meta(NaN, 0, 0))).toEqual({ ok: true, duration: 0, w: 1280, h: 720 })
  expect(await checkVideo(file(5), async () => { throw new Error('decode failed') }))
    .toEqual({ ok: true, duration: 0, w: 1280, h: 720 })
})
