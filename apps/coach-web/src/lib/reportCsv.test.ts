import { CSV_HEADERS, planImport, reportsToCsv } from './reportCsv'
import { parseCsv, toCsv } from './csv'
import type { AdminReport } from './queries/admin'

const report = (o: Partial<AdminReport> = {}): AdminReport => ({
  id: 'r1', reason: 'harassment', details: null, status: 'open', created_at: '2026-10-18T10:00:00Z',
  resolved_at: null, resolution_note: null, message_id: 'm1',
  content_snapshot: { kind: 'text', body: '=cmd|calc' },
  reporter_id: 'u1', reporter_name: 'Maya Chen', reporter_email: 'maya@x.app',
  reported_user_id: 'u2', reported_name: 'Marcus Hale', reported_email: 'm@x.app',
  reported_suspended_at: null, reported_open_reports: 1, actions_taken: [], starred: false, read_at: null, ...o,
})

/** Build an edited export: fill the editable columns for given report ids. */
function edited(reports: AdminReport[], edits: Record<string, [string, string, string]>) {
  const rows = parseCsv(reportsToCsv(reports))
  const n = rows[0].length
  for (const r of rows.slice(1)) {
    const e = edits[r[0]]
    if (e) { r[n - 3] = e[0]; r[n - 2] = e[1]; r[n - 1] = e[2] }
  }
  return toCsv(rows)
}

test('export has headers, one row per report, and escapes formula content', () => {
  const rows = parseCsv(reportsToCsv([report(), report({ id: 'r2' })]))
  expect(rows[0]).toEqual([...CSV_HEADERS])
  expect(rows).toHaveLength(3)
  expect(rows[1][CSV_HEADERS.indexOf('reported_content')]).toBe("'=cmd|calc")
})

test('untouched rows are skipped; valid edits are planned', () => {
  const rs = [report(), report({ id: 'r2' })]
  const plan = planImport(edited(rs, { r1: ['actioned', 'delete_message', 'slur'] }), rs)
  expect(plan.skipped).toBe(1)
  expect(plan.changes).toHaveLength(1)
  expect(plan.changes[0]).toMatchObject({ reportId: 'r1', action: 'delete_message', newStatus: 'actioned', note: 'slur', problems: [] })
})

test('validation: unknown values, actioned without action, stale state; note optional', () => {
  const rs = [report(), report({ id: 'r2', message_id: null }), report({ id: 'r3', reported_suspended_at: '2026-10-18T11:00:00Z' })]
  const plan = planImport(edited(rs, {
    r1: ['actioned', '', ''],
    r2: ['', 'delete_message', 'x'],
    r3: ['', 'suspend', 'x'],
  }), rs)
  const p = Object.fromEntries(plan.changes.map((c) => [c.reportId, c.problems.join(' | ')]))
  expect(p.r1).not.toMatch(/note/)
  expect(p.r1).toMatch(/needs an action/)
  expect(p.r2).toMatch(/already deleted/)
  expect(p.r3).toMatch(/Already suspended/)

  const bad = planImport(edited([report()], { r1: ['closed', 'ban', 'x'] }), [report()])
  expect(bad.changes[0].problems.join(' ')).toMatch(/Unknown new_status.*Unknown action/)
})

test('unknown report ids, duplicates, and a missing column', () => {
  const csv = toCsv([[...CSV_HEADERS], ...['nope', 'r1', 'r1'].map((id) => {
    const r = CSV_HEADERS.map(() => '')
    r[0] = id; r[CSV_HEADERS.length - 3] = 'dismissed'; r[CSV_HEADERS.length - 1] = 'n'
    return r
  })])
  const plan = planImport(csv, [report()])
  expect(plan.changes[0].problems[0]).toMatch(/not found/)
  expect(plan.changes[1].problems).toEqual([])
  expect(plan.changes[2].problems.join(' ')).toMatch(/more than once/)

  expect(planImport('report_id,status\nr1,open\n', [report()]).fileError).toMatch(/Missing columns: new_status, action, note/)
})

test('dismissing needs no action; actioned is fine when an action was already taken', () => {
  const rs = [report(), report({ id: 'r2', actions_taken: ['suspend'], reported_suspended_at: 'x' })]
  const plan = planImport(edited(rs, { r1: ['dismissed', '', 'ok'], r2: ['actioned', '', 'done'] }), rs)
  expect(plan.changes.every((c) => c.problems.length === 0)).toBe(true)
})
