import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { anon, createAndSignIn } from './helpers'

describe('search_coaches RPC', () => {
  let me: any
  beforeAll(async () => {
    me = await createAndSignIn({ role: 'coach', name: 'Searcher', title: 'Head Coach' })
    await createAndSignIn({ role: 'coach', name: 'Zinnia Findme', title: 'Assistant Coach' })
    await createAndSignIn({ role: 'athlete', name: 'Zinnia Athlete' })
  })

  it('finds coaches by name and never athletes', async () => {
    const { data, error } = await me.client.rpc('search_coaches', { p_query: 'Zinnia' })
    expect(error).toBeNull()
    const names = (data as any[]).map((r) => r.name)
    expect(names).toContain('Zinnia Findme')
    expect(names).not.toContain('Zinnia Athlete')
    const row = (data as any[]).find((r) => r.name === 'Zinnia Findme')
    expect(row.title).toBe('Assistant Coach')
    expect(row.initials).toBe('ZF')
  })

  it('anon cannot search', async () => {
    const { error } = await anon().rpc('search_coaches', { p_query: 'Zinnia' })
    expect(error).not.toBeNull()
  })
})
