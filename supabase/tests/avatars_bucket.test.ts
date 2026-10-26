import 'dotenv/config'
import { describe, it, expect } from 'vitest'
import { anon, createAndSignIn } from './helpers'

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9])

describe('avatars bucket', () => {
  it('lets a user upload their own photo and anyone view it by URL', async () => {
    const { id, client } = await createAndSignIn({ role: 'athlete', name: 'Avatar Owner' })
    const path = `${id}/avatar`
    const up = await client.storage.from('avatars').upload(path, JPEG, { contentType: 'image/jpeg', upsert: true })
    expect(up.error).toBeNull()
    // Re-uploading (upsert) still works without the public read policy.
    const again = await client.storage.from('avatars').upload(path, JPEG, { contentType: 'image/jpeg', upsert: true })
    expect(again.error).toBeNull()
    const res = await fetch(anon().storage.from('avatars').getPublicUrl(path).data.publicUrl)
    expect(res.status).toBe(200)
  })

  it('stops anonymous callers from listing avatar folders', async () => {
    const { id, client } = await createAndSignIn({ role: 'athlete', name: 'Listed' })
    await client.storage.from('avatars').upload(`${id}/avatar`, JPEG, { contentType: 'image/jpeg', upsert: true })
    const { data } = await anon().storage.from('avatars').list(id)
    expect(data ?? []).toHaveLength(0)
  })

  it('rejects non-image and SVG uploads', async () => {
    const { id, client } = await createAndSignIn({ role: 'athlete', name: 'Bad Type' })
    const html = await client.storage.from('avatars').upload(`${id}/page.html`, '<h1>x</h1>', { contentType: 'text/html' })
    expect(html.error).not.toBeNull()
    const svg = await client.storage.from('avatars').upload(`${id}/avatar.svg`, '<svg/>', { contentType: 'image/svg+xml' })
    expect(svg.error).not.toBeNull()
  })

  it('rejects files over 5 MB', async () => {
    const { id, client } = await createAndSignIn({ role: 'athlete', name: 'Too Big' })
    const big = new Uint8Array(5 * 1024 * 1024 + 1)
    const { error } = await client.storage.from('avatars').upload(`${id}/avatar`, big, { contentType: 'image/jpeg', upsert: true })
    expect(error).not.toBeNull()
  })
})
