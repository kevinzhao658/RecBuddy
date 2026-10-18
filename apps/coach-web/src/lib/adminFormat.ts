// Pure display helpers for the admin console.

export const REPORT_REASONS: Record<string, string> = {
  harassment: 'Harassment or bullying',
  hate: 'Hate speech or slurs',
  sexual: 'Sexual or inappropriate content',
  violence: 'Threats, violence, or self-harm',
  spam: 'Spam or scam',
  other: 'Something else',
}

export const reasonLabel = (r: string) => REPORT_REASONS[r] ?? r

export const ACTION_LABELS: Record<string, string> = {
  resolve_report: 'Resolved report',
  delete_message: 'Deleted message',
  suspend: 'Suspended user',
  unsuspend: 'Lifted suspension',
  delete_user: 'Removed user',
  remove_link: 'Removed coach link',
  set_head: 'Changed head coach',
}
export const actionLabel = (a: string) => ACTION_LABELS[a] ?? a

interface MessageLike { kind?: string; body?: string | null; payload?: Record<string, unknown> | null }

/** One-line text for any chat message kind (photos, cards, plain text). */
export function describeMessage(m: MessageLike | null | undefined): string {
  if (!m) return 'No message — the user was reported directly.'
  const p = m.payload ?? {}
  const str = (k: string) => (typeof p[k] === 'string' || typeof p[k] === 'number' ? String(p[k]) : '')
  switch (m.kind) {
    case 'image':   return `[Photo]${m.body ? ` ${m.body}` : ''}`
    case 'workout': return `[Workout] ${str('title')}`.trim()
    case 'runcard': return `[Logged run] ${str('title')}${str('note') ? ` — ${str('note')}` : ''}`.trim()
    case 'adjust':  return `[Plan change] ${str('from')} → ${str('to')}${str('reason') ? ` — ${str('reason')}` : ''}`
    default:        return m.body ?? ''
  }
}

/** "Oct 18, 2:05 PM" — local time, compact. */
export function fmtWhen(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** Hours since a timestamp — drives the "over 24h" SLA badge on open reports. */
export function hoursSince(iso: string, now: Date = new Date()): number {
  return (now.getTime() - new Date(iso).getTime()) / 3_600_000
}

// ── Reports queue: filter + sort (pure, client-side over the loaded page) ──

export type ReportSort = 'newest' | 'oldest' | 'most_reported' | 'reason'

export const REPORT_SORTS: { value: ReportSort; label: string }[] = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'most_reported', label: 'Most-reported users' },
  { value: 'reason', label: 'Reason (A–Z)' },
]

interface QueueRow {
  reason: string
  created_at: string
  reported_name: string | null
  reported_email: string | null
  reporter_name: string | null
  reporter_email: string | null
  details: string | null
  reported_open_reports: number
  content_snapshot: MessageLike | null
  starred?: boolean
  read_at?: string | null
}

export interface ReportFilter {
  q?: string            // matches names, emails, the reporter's note, and the reported content
  reason?: string       // '' / undefined = any
  overdueOnly?: boolean // open > 24h
  starredOnly?: boolean
  unreadOnly?: boolean
  sort?: ReportSort
}

export function filterSortReports<T extends QueueRow>(rows: T[], f: ReportFilter, now: Date = new Date()): T[] {
  const q = f.q?.trim().toLowerCase() ?? ''
  const out = rows.filter((r) => {
    if (f.reason && r.reason !== f.reason) return false
    if (f.overdueOnly && hoursSince(r.created_at, now) <= 24) return false
    if (f.starredOnly && !r.starred) return false
    if (f.unreadOnly && r.read_at) return false
    if (!q) return true
    return [r.reported_name, r.reported_email, r.reporter_name, r.reporter_email, r.details, describeMessage(r.content_snapshot)]
      .some((v) => v?.toLowerCase().includes(q))
  })
  const time = (r: QueueRow) => new Date(r.created_at).getTime()
  switch (f.sort ?? 'newest') {
    case 'oldest': return out.sort((a, b) => time(a) - time(b))
    case 'most_reported': return out.sort((a, b) => b.reported_open_reports - a.reported_open_reports || time(b) - time(a))
    case 'reason': return out.sort((a, b) => reasonLabel(a.reason).localeCompare(reasonLabel(b.reason)) || time(b) - time(a))
    default: return out.sort((a, b) => time(b) - time(a))
  }
}
