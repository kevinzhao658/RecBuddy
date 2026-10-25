import { describe, it, expect } from 'vitest'
import { preview } from '../functions/notify-message/preview.ts'

describe('push preview', () => {
  it('photos and videos get their own line', () => {
    expect(preview('image', null, null, 'Dani')).toEqual({ title: 'Dani', body: 'Sent a photo' })
    expect(preview('video', 'nice form', null, 'Dani')).toEqual({ title: 'Dani', body: 'Sent a video' })
  })
})
