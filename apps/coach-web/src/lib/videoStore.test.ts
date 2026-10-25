import 'fake-indexeddb/auto'
import { getVideo, putVideo, hasVideo } from './videoStore'

test('put then get returns the same bytes', async () => {
  await putVideo('m1', new Blob([new Uint8Array([1, 2, 3])], { type: 'video/mp4' }))
  const got = await getVideo('m1')
  expect(got).not.toBeNull()
  expect(got!.type).toBe('video/mp4')
  const bytes = await new Promise<ArrayBuffer>((res) => { const r = new FileReader(); r.onload = () => res(r.result as ArrayBuffer); r.readAsArrayBuffer(got!) })
  expect(new Uint8Array(bytes)).toEqual(new Uint8Array([1, 2, 3]))
})

test('get of an unknown id is null', async () => {
  expect(await getVideo('nope')).toBeNull()
})

test('get resolves null (not throws) when IndexedDB is unavailable', async () => {
  const real = globalThis.indexedDB
  // @ts-expect-error simulate a browser without IndexedDB (private mode, blocked storage)
  delete globalThis.indexedDB
  try {
    vi.resetModules()
    const { getVideo: fresh, putVideo: freshPut } = await import('./videoStore')
    expect(await fresh('m1')).toBeNull()
    await expect(freshPut('m2', new Blob(['x']))).resolves.toBeUndefined()
  } finally {
    globalThis.indexedDB = real
  }
})

test('hasVideo answers without loading the bytes', async () => {
  await putVideo('m9', new Blob([new Uint8Array([9])], { type: 'video/mp4' }))
  expect(await hasVideo('m9')).toBe(true)
  expect(await hasVideo('missing')).toBe(false)
})
