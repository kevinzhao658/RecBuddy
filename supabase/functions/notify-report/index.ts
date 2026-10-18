import { createClient } from 'jsr:@supabase/supabase-js@2'

// Emails support about every new content report (App Store guideline 1.2:
// reports need a timely response — the Terms promise review within 24 hours).
//
// Trigger: Database Webhook (dashboard, dev + prod) — INSERT on public.content_reports
// → POST /functions/v1/notify-report with header x-webhook-secret: <WEBHOOK_SECRET>.
// Secrets: RESEND_API_KEY, WEBHOOK_SECRET; optional REPORT_ALERT_TO
// (default support@recbuddy.app), REPORT_ALERT_FROM (a sender on a domain
// verified in Resend), ADMIN_REPORTS_URL (admin console link; falls back to the
// Supabase table editor).

import { renderReportEmail, type Person, type ReportRecord } from './render.ts'

Deno.serve(async (req) => {
  if (req.headers.get('x-webhook-secret') !== Deno.env.get('WEBHOOK_SECRET')) {
    return new Response('forbidden', { status: 403 })
  }
  let record: (ReportRecord & { reporter_id?: string | null; reported_user_id?: string | null }) | undefined
  try {
    ;({ record } = await req.json())
  } catch {
    return new Response('bad request', { status: 400 })
  }
  if (!record?.id) return new Response('no record', { status: 400 })

  const url = Deno.env.get('SUPABASE_URL')!
  const supa = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const ids = [record.reporter_id, record.reported_user_id].filter(Boolean) as string[]
  const { data: people, error } = await supa.from('profiles').select('id, name, email').in('id', ids)
  if (error) { console.error('profiles query', error); return new Response('retry', { status: 500 }) }
  const find = (id?: string | null): Person => people?.find((p) => p.id === id) ?? null

  const ref = new URL(url).hostname.split('.')[0]
  const link = Deno.env.get('ADMIN_REPORTS_URL')
    ? `${Deno.env.get('ADMIN_REPORTS_URL')}?id=${record.id}`
    : `https://supabase.com/dashboard/project/${ref}/editor?schema=public&table=content_reports`
  const mail = renderReportEmail(record, find(record.reporter_id), find(record.reported_user_id), link)

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'content-type': 'application/json',
      // Webhook retries must not send the same alert twice.
      'idempotency-key': `report-${record.id}`,
    },
    body: JSON.stringify({
      from: Deno.env.get('REPORT_ALERT_FROM') ?? 'RecBuddy Reports <reports@recbuddy.app>',
      to: [Deno.env.get('REPORT_ALERT_TO') ?? 'support@recbuddy.app'],
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
    }),
  })
  if (!res.ok) {
    console.error('resend', res.status, await res.text().catch(() => ''))
    // 5xx/429 → let the webhook retry; 4xx config errors won't fix themselves.
    return new Response('send failed', { status: res.status >= 500 || res.status === 429 ? 500 : 200 })
  }
  return new Response('ok')
})
