// Reports ⇄ CSV for offline review. Export every report with three editable
// columns (new_status, action, note); re-import validates each row against the
// live reports before anything is applied.

import { parseCsv, toCsv } from './csv'
import { describeMessage, reasonLabel } from './adminFormat'
import type { AdminReport, ReportStatus } from './queries/admin'

export const EDITABLE = ['new_status', 'action', 'note'] as const

export const CSV_HEADERS = [
  'report_id', 'status', 'reason', 'reported_at',
  'reported_user', 'reported_email', 'reported_user_id', 'reported_suspended',
  'reported_by', 'reporter_email', 'reporter_note',
  'reported_content', 'message_still_exists', 'actions_taken', 'resolution_note',
  ...EDITABLE,
] as const

export const IMPORT_ACTIONS = ['delete_message', 'suspend', 'unsuspend', 'delete_user'] as const
export type ImportAction = typeof IMPORT_ACTIONS[number]
const STATUSES: ReportStatus[] = ['open', 'actioned', 'dismissed']

export function reportsToCsv(reports: AdminReport[]): string {
  return toCsv([
    [...CSV_HEADERS],
    ...reports.map((r) => [
      r.id, r.status, reasonLabel(r.reason), r.created_at,
      r.reported_name ?? '(deleted)', r.reported_email ?? '', r.reported_user_id ?? '', r.reported_suspended_at ? 'yes' : 'no',
      r.reporter_name ?? '(deleted)', r.reporter_email ?? '', r.details ?? '',
      describeMessage(r.content_snapshot), r.message_id ? 'yes' : 'no', r.actions_taken.join(' '), r.resolution_note ?? '',
      '', '', '',
    ]),
  ])
}

export interface PlannedChange {
  line: number              // 1-based line in the file (header = 1)
  reportId: string
  who: string               // reported user's name, for the preview
  action?: ImportAction
  newStatus?: ReportStatus
  note: string
  problems: string[]        // non-empty = will NOT be applied
  report?: AdminReport
}

export interface ImportPlan {
  changes: PlannedChange[]  // rows that ask for something (valid or not)
  skipped: number           // rows with nothing filled in
  fileError?: string
}

/** Validate an edited export against the current reports. Pure — no I/O. */
export function planImport(text: string, reports: AdminReport[]): ImportPlan {
  const rows = parseCsv(text)
  if (rows.length === 0) return { changes: [], skipped: 0, fileError: 'The file is empty.' }
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const col = (name: string) => header.indexOf(name)
  const missing = ['report_id', ...EDITABLE].filter((h) => col(h) < 0)
  if (missing.length) {
    return { changes: [], skipped: 0, fileError: `Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Start from a fresh export.` }
  }
  const byId = new Map(reports.map((r) => [r.id, r]))
  const seen = new Set<string>()
  const changes: PlannedChange[] = []
  let skipped = 0

  rows.slice(1).forEach((cells, i) => {
    const get = (name: string) => (cells[col(name)] ?? '').trim()
    const rawStatus = get('new_status').toLowerCase()
    const rawAction = get('action').toLowerCase()
    const note = get('note')
    if (!rawStatus && !rawAction) { skipped++; return }

    const reportId = get('report_id')
    const report = byId.get(reportId)
    const problems: string[] = []
    const newStatus = rawStatus ? (STATUSES.find((s) => s === rawStatus)) : undefined
    const action = rawAction ? IMPORT_ACTIONS.find((a) => a === rawAction) : undefined

    if (!report) problems.push('Report not found — it may have been deleted, or the ID was edited.')
    if (seen.has(reportId)) problems.push('This report appears more than once in the file.')
    seen.add(reportId)
    if (rawStatus && !newStatus) problems.push(`Unknown new_status "${rawStatus}" (use open, actioned, or dismissed).`)
    if (rawAction && !action) problems.push(`Unknown action "${rawAction}" (use ${IMPORT_ACTIONS.join(', ')}).`)

    if (report) {
      if (newStatus && newStatus === report.status && !action) problems.push(`Already ${report.status}.`)
      if (newStatus === 'actioned' && !action && report.actions_taken.length === 0) {
        problems.push('"actioned" needs an action — in this row or one already taken. Nothing wrong? Use dismissed.')
      }
      if (action === 'delete_message' && !report.message_id) problems.push('The message is already deleted.')
      if (action && action !== 'delete_message' && !report.reported_user_id) problems.push('The reported user no longer exists.')
      if (action === 'suspend' && report.reported_suspended_at) problems.push('Already suspended.')
      if (action === 'unsuspend' && !report.reported_suspended_at) problems.push('Not suspended.')
    }

    changes.push({
      line: i + 2, reportId, who: report?.reported_name ?? '(unknown)',
      action, newStatus, note, problems, report,
    })
  })

  // Two rows removing / suspending the same person: only the first can run.
  const userActs = new Map<string, number>()
  for (const c of changes) {
    if (!c.problems.length && c.action && c.action !== 'delete_message' && c.report?.reported_user_id) {
      const uid = c.report.reported_user_id
      if (c.action === 'delete_user' && userActs.has(uid)) c.problems.push('Another row already acts on this user.')
      userActs.set(uid, (userActs.get(uid) ?? 0) + 1)
    }
  }
  return { changes, skipped }
}
