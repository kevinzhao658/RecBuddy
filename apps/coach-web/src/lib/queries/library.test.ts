import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { makeCoach } from '../../test/helpers'
import { fetchLibrary, createLibraryWorkout } from './library'

const URL = process.env.SUPABASE_URL!, ANON = process.env.SUPABASE_ANON_KEY!

describe('library queries', () => {
  let client: any
  beforeAll(async () => {
    const c = await makeCoach(); client = createClient(URL, ANON, { auth: { persistSession: false } })
    await client.auth.signInWithPassword({ email: c.email, password: c.password })
  })
  it('creates a custom template and lists it', async () => {
    await createLibraryWorkout(client, { type: 'tempo', title: 'My Tempo', dist: 6, pace: '8:00/mi', note: '', sets: [] })
    const lib = await fetchLibrary(client)
    const mine = lib.find((t) => t.title === 'My Tempo')
    expect(mine?.custom).toBe(true)
  })
})
