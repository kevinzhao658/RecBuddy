import 'dotenv/config'
import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, createAndSignIn } from './helpers'

describe('auth + profile trigger', () => {
  it('creates a coach profile (promoted by service role) with role + title', async () => {
    const { id } = await createAndSignIn({ role: 'coach', name: 'Test Coach', title: 'Head Coach' })
    const { data, error } = await admin().from('profiles').select('*').eq('id', id).single()
    expect(error).toBeNull()
    expect(data!.role).toBe('coach')
    expect(data!.title).toBe('Head Coach')
    expect(data!.initials).toBe('TC')
  })

  it('creates an athlete profile with experience + goal', async () => {
    const { id } = await createAndSignIn({
      role: 'athlete', name: 'Runner One', experience_level: 'returning', primary_goal: 'pr',
    })
    const { data } = await admin().from('profiles').select('*').eq('id', id).single()
    expect(data!.role).toBe('athlete')
    expect(data!.experience_level).toBe('returning')
    expect(data!.primary_goal).toBe('pr')
  })

  it('does NOT let a client self-assign the coach role via user_metadata', async () => {
    // Simulate a malicious self-signup that crams role/title into user_metadata
    // (the client-writable bucket). The trigger ignores it — no service-role
    // promotion happens — so the profile stays an athlete.
    const sql = admin()
    const { data, error } = await sql.auth.admin.createUser({
      email: `escalate-${randomUUID()}@test.recbuddy.app`,
      password: 'test-password-123',
      email_confirm: true,
      user_metadata: { role: 'coach', title: 'Head Coach', name: 'Sneaky' },
    })
    expect(error).toBeNull()
    const prof = await sql.from('profiles').select('role,title').eq('id', data.user!.id).single()
    expect(prof.data!.role).toBe('athlete') // defaulted, NOT coach
    expect(prof.data!.title).toBeNull()
  })
})
