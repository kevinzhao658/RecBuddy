// Pure email rendering for notify-report (no Deno/network APIs — unit-tested
// from supabase/tests/notify_report_render.test.ts).

const REASONS: Record<string, string> = {
  harassment: 'Harassment or bullying',
  hate: 'Hate speech or slurs',
  sexual: 'Sexual or inappropriate content',
  violence: 'Threats, violence, or self-harm',
  spam: 'Spam or scam',
  other: 'Something else',
}

export type Person = { name: string | null; email: string | null } | null
export type ReportRecord = {
  id: string
  reason: string
  details: string | null
  content_snapshot: { kind?: string; body?: string | null; payload?: Record<string, unknown> | null; sent_at?: string } | null
  created_at: string
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

const who = (p: Person) => (p ? `${p.name ?? 'Unknown'}${p.email ? ` <${p.email}>` : ''}` : '(deleted account)')

/** What the reported message showed, as plain text. */
export function describeContent(snap: ReportRecord['content_snapshot']): string {
  if (!snap) return '(no message — the user was reported directly)'
  const p = snap.payload ?? {}
  switch (snap.kind) {
    case 'image':   return `[Photo${p.path ? `: chat-images/${p.path}` : ''}]${snap.body ? ` — caption: ${snap.body}` : ''}`
    case 'video':   return `[Video${p.path ? `: chat-videos/${p.path}` : ''}]${snap.body ? ` — caption: ${snap.body}` : ''}`
    case 'workout': return `[Workout card] ${p.title ?? ''}`
    case 'runcard': return `[Logged run] ${p.title ?? ''}${p.note ? ` — note: ${p.note}` : ''}`
    case 'adjust':  return `[Plan adjustment] ${p.from ?? ''} → ${p.to ?? ''}${p.reason ? ` — ${p.reason}` : ''}`
    default:        return snap.body ?? ''
  }
}

/** Pure: builds the alert email (unit-testable, no I/O). */
export function renderReportEmail(r: ReportRecord, reporter: Person, reported: Person, link: string) {
  const reason = REASONS[r.reason] ?? r.reason
  const subject = `[RecBuddy report] ${reason} — ${reported?.name ?? 'user'}`
  const content = describeContent(r.content_snapshot)
  const rows: [string, string][] = [
    ['Reason', reason],
    ['Reported user', who(reported)],
    ['Reported by', who(reporter)],
    ['Reporter details', r.details ?? '—'],
    ['Message sent', r.content_snapshot?.sent_at ?? '—'],
    ['Reported at', r.created_at],
    ['Report ID', r.id],
  ]
  const text = [
    'A user reported content on RecBuddy. Review and act within 24 hours.',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Reported content:',
    content,
    '',
    `Review: ${link}`,
  ].join('\n')
  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:560px">
<p><strong>A user reported content on RecBuddy.</strong> Review and act within 24 hours.</p>
<table cellpadding="6" style="border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="color:#666;vertical-align:top">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join('')}</table>
<p style="color:#666;margin-bottom:4px">Reported content</p>
<blockquote style="margin:0;padding:10px 14px;border-left:3px solid #c00;background:#f6f6f6;white-space:pre-wrap">${esc(content)}</blockquote>
<p><a href="${esc(link)}">Review this report</a></p>
</div>`
  return { subject, text, html }
}
