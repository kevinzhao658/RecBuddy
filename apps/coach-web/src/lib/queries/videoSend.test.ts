// @vitest-environment node
// Node's File/Blob upload as binary; jsdom's are sent as text.
import 'fake-indexeddb/auto'
import { createClient } from '@supabase/supabase-js'
import { admin, makeCoach } from '../../test/helpers'
import { sendVideoMessage } from './chat'
import { getVideo } from '../videoStore'

const URL_ = process.env.SUPABASE_URL!, ANON = process.env.SUPABASE_ANON_KEY!

test('sendVideoMessage uploads the clip and poster, posts the message, and keeps a local copy', async () => {
  const c = await makeCoach('Video Sender')
  const client = createClient(URL_, ANON, { auth: { persistSession: false } })
  await client.auth.signInWithPassword({ email: c.email, password: c.password })
  const { data: t } = await admin().from('message_threads').insert({ kind: 'chat' }).select().single()
  await admin().from('thread_members').insert({ thread_id: t!.id, user_id: c.id, status: 'active' })

  const file = new File([new Uint8Array([0, 0, 0, 24])], 'clip.mp4', { type: 'video/mp4' })
  const poster = new Blob([new Uint8Array([255, 216])], { type: 'image/jpeg' })
  const id = await sendVideoMessage(client, t!.id, { file, duration: 12, w: 720, h: 1280, poster }, 'form check')

  const { data: m } = await admin().from('messages').select('kind, body, payload, expires_at').eq('id', id).single()
  expect(m).toMatchObject({ kind: 'video', body: 'form check', payload: { w: 720, h: 1280, duration_s: 12 } })
  expect(m!.payload.path).toMatch(new RegExp(`^${t!.id}/.+\\.mp4$`))
  expect(m!.payload.poster).toMatch(new RegExp(`^${t!.id}/.+\\.jpg$`))
  expect(m!.expires_at).not.toBeNull()
  expect(await getVideo(id)).not.toBeNull()
})
