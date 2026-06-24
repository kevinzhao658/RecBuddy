import 'dotenv/config'
import { describe, it, expect } from 'vitest'
import { admin } from './helpers'

describe('schema', () => {
  it('has the core tables', async () => {
    const sql = admin()
    const { data, error } = await sql
      .from('profiles')
      .select('id')
      .limit(0)
    expect(error).toBeNull()
    expect(data).toEqual([])
  })
})
