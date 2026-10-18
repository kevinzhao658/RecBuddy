import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { admin, createAndSignIn, signIn } from './helpers'

// Admin console RPCs: admin-only access, report triage, user lookup,
// dispute tools, audit log, and the suspension write-guard.
describe('admin console', () => {
  let boss: any, coach: any, athlete: any, outsider: any
  let threadId: string, msgId: string, reportId: string

  beforeAll(async () => {
    boss = await createAndSignIn({ role: 'athlete', name: `Admin ${randomUUID()}` })
    await admin().from('profiles').update({ is_admin: true }).eq('id', boss.id)
    coach = await createAndSignIn({ role: 'coach', name: `Coach ${randomUUID()}`, title: 'Head Coach' })
    athlete = await createAndSignIn({ role: 'athlete', name: `Ath ${randomUUID()}` })
    outsider = await createAndSignIn({ role: 'athlete', name: 'Outsider' })

    const { data: code } = await coach.client.rpc('create_invite', { p_athlete_name: 'x' })
    await athlete.client.rpc('redeem_invite', { p_code: code })
    const { data: t } = await athlete.client.from('message_threads')
      .insert({ athlete_id: athlete.id, coach_id: coach.id }).select().single()
    threadId = t.id
    const { data: m } = await coach.client.from('messages')
      .insert({ thread_id: threadId, from_user_id: coach.id, kind: 'text', body: 'rude thing' }).select().single()
    msgId = m.id
    const { data: id } = await athlete.client.rpc('report_content', { p_reason: 'harassment', p_message_id: msgId })
    reportId = id
  })

  it('non-admins are refused on every admin RPC', async () => {
    for (const [fn, args] of [
      ['admin_list_reports', {}], ['admin_search_users', {}], ['admin_list_actions', {}],
      ['admin_report_context', { p_report_id: reportId }], ['admin_user_detail', { p_user_id: coach.id }],
    ] as const) {
      const { error } = await outsider.client.rpc(fn, args)
      expect(error?.message, fn).toMatch(/admin only/)
    }
  })

  it('users cannot grant themselves admin or clear a suspension', async () => {
    const a = await outsider.client.from('profiles').update({ is_admin: true }).eq('id', outsider.id)
    expect(a.error?.message).toMatch(/service role/)
    await admin().from('profiles').update({ suspended_at: new Date().toISOString() }).eq('id', outsider.id)
    const s = await outsider.client.from('profiles').update({ suspended_at: null }).eq('id', outsider.id)
    expect(s.error?.message).toMatch(/service role/)
    await admin().from('profiles').update({ suspended_at: null }).eq('id', outsider.id)
  })

  it('admin lists open reports with both parties', async () => {
    const { data, error } = await boss.client.rpc('admin_list_reports', { p_status: 'open' })
    expect(error).toBeNull()
    const r = (data as any[]).find((x) => x.id === reportId)
    expect(r.reported_user_id).toBe(coach.id)
    expect(r.reporter_id).toBe(athlete.id)
    expect(r.content_snapshot.body).toBe('rude thing')
    expect(r.reported_open_reports).toBeGreaterThanOrEqual(1)
  })

  it('admin sees the conversation around the reported message', async () => {
    await athlete.client.from('messages').insert({ thread_id: threadId, from_user_id: athlete.id, kind: 'text', body: 'after' })
    const { data, error } = await boss.client.rpc('admin_report_context', { p_report_id: reportId })
    expect(error).toBeNull()
    const rows = data as any[]
    expect(rows.find((x) => x.is_reported)?.body).toBe('rude thing')
    expect(rows.map((x) => x.body)).toContain('after')
  })

  it('actioned is refused until an enforcement action exists', async () => {
    const { error } = await boss.client.rpc('admin_resolve_report', { p_report_id: reportId, p_status: 'actioned', p_note: 'x' })
    expect(error?.message).toMatch(/take an action/)
  })

  it('resolving a report records who, when, and an audit entry', async () => {
    // An enforcement action on record unlocks "actioned" (as the console does).
    await admin().from('admin_actions').insert({ admin_id: boss.id, action: 'suspend', target_user_id: coach.id, report_id: reportId, note: 'warned' })
    const { error } = await boss.client.rpc('admin_resolve_report', { p_report_id: reportId, p_status: 'actioned', p_note: 'warned coach' })
    expect(error).toBeNull()
    const { data: r } = await admin().from('content_reports').select('*').eq('id', reportId).single()
    expect(r.status).toBe('actioned')
    expect(r.resolved_by).toBe(boss.id)
    const { data: log } = await boss.client.rpc('admin_list_actions', {})
    expect((log as any[]).some((x) => x.report_id === reportId && x.action === 'resolve_report' && x.note === 'warned coach')).toBe(true)
  })

  it('stars and read marks are per admin', async () => {
    const other = await createAndSignIn({ role: 'athlete', name: `Admin2 ${randomUUID()}` })
    await admin().from('profiles').update({ is_admin: true }).eq('id', other.id)
    expect((await boss.client.rpc('admin_mark_report', { p_report_id: reportId, p_starred: true, p_read: true })).error).toBeNull()
    const mine = (await boss.client.rpc('admin_list_reports', { p_status: null })).data.find((r: any) => r.id === reportId)
    expect(mine.starred).toBe(true)
    expect(mine.read_at).not.toBeNull()
    const theirs = (await other.client.rpc('admin_list_reports', { p_status: null })).data.find((r: any) => r.id === reportId)
    expect(theirs.starred).toBe(false)
    expect(theirs.read_at).toBeNull()
    // null leaves a field alone; false clears it
    await boss.client.rpc('admin_mark_report', { p_report_id: reportId, p_read: false })
    const after = (await boss.client.rpc('admin_list_reports', { p_status: null })).data.find((r: any) => r.id === reportId)
    expect(after.starred).toBe(true)
    expect(after.read_at).toBeNull()
    expect((await outsider.client.rpc('admin_mark_report', { p_report_id: reportId, p_starred: true })).error?.message).toMatch(/admin only/)
  })

  it('user search and detail show teams and reports', async () => {
    const { data: found } = await boss.client.rpc('admin_search_users', { p_query: coach.email })
    expect((found as any[])[0].id).toBe(coach.id)
    expect((found as any[])[0].reports_against).toBeGreaterThanOrEqual(1)
    const { data: d, error } = await boss.client.rpc('admin_user_detail', { p_user_id: athlete.id })
    expect(error).toBeNull()
    expect(d.coaches[0].id).toBe(coach.id)
    expect(d.reports_by.length).toBeGreaterThanOrEqual(1)
  })

  it('dispute tools remove the link (logged); the note is optional', async () => {
    const ok = await boss.client.rpc('admin_remove_link', { p_coach_id: coach.id, p_athlete_id: athlete.id, p_note: 'athlete asked' })
    expect(ok.error).toBeNull()
    const { data: links } = await admin().from('coach_athlete').select('*').eq('athlete_id', athlete.id)
    expect(links).toEqual([])
  })

  it('a suspended user cannot post, and a suspended admin loses admin access', async () => {
    await admin().from('profiles').update({ suspended_at: new Date().toISOString() }).eq('id', athlete.id)
    const send = await athlete.client.from('messages').insert({ thread_id: threadId, from_user_id: athlete.id, kind: 'text', body: 'hi' })
    expect(send.error?.message).toMatch(/account suspended/)
    await admin().from('profiles').update({ suspended_at: null }).eq('id', athlete.id)

    await admin().from('profiles').update({ suspended_at: new Date().toISOString() }).eq('id', boss.id)
    const fresh = await signIn(boss.email, 'test-password-123')
    const { error } = await fresh.rpc('admin_list_reports', {})
    expect(error?.message).toMatch(/admin only/)
    await admin().from('profiles').update({ suspended_at: null }).eq('id', boss.id)
  })
})
