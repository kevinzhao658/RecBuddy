import 'dotenv/config'
import { describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { anon, createUser } from './helpers'

describe('email_has_account', () => {
  it('is true for a registered email, ignoring case and surrounding spaces', async () => {
    const { email } = await createUser({ role: 'athlete', name: 'Reset Check' })
    const { data, error } = await anon().rpc('email_has_account', { p_email: `  ${email.toUpperCase()} ` })
    expect(error).toBeNull()
    expect(data).toBe(true)
  })

  it('is false for an unknown email', async () => {
    const { data, error } = await anon().rpc('email_has_account', { p_email: `nobody-${randomUUID()}@test.recbuddy.app` })
    expect(error).toBeNull()
    expect(data).toBe(false)
  })
})
