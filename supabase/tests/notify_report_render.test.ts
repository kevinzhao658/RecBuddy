import { describe, it, expect } from 'vitest'
import { renderReportEmail, describeContent } from '../functions/notify-report/render.ts'

const base = {
  id: 'r-1',
  reason: 'harassment',
  details: 'keeps doing this',
  content_snapshot: { kind: 'text', body: 'you are <b>slow</b>', sent_at: '2026-10-18T10:00:00Z' },
  created_at: '2026-10-18T11:00:00Z',
}

describe('notify-report email', () => {
  it('names the reason, both users, the content and the review link', () => {
    const m = renderReportEmail(base, { name: 'Maya', email: 'maya@x.app' }, { name: 'Marcus', email: 'm@x.app' }, 'https://admin/r-1')
    expect(m.subject).toBe('[RecBuddy report] Harassment or bullying — Marcus')
    expect(m.text).toContain('Reported user: Marcus <m@x.app>')
    expect(m.text).toContain('Reported by: Maya <maya@x.app>')
    expect(m.text).toContain('you are <b>slow</b>')
    expect(m.text).toContain('https://admin/r-1')
  })

  it('escapes user content in the HTML body', () => {
    const m = renderReportEmail(base, null, null, 'https://admin/r-1')
    expect(m.html).not.toContain('<b>slow</b>')
    expect(m.html).toContain('&lt;b&gt;slow&lt;/b&gt;')
    expect(m.text).toContain('(deleted account)')
  })

  it('describes non-text content and direct user reports', () => {
    expect(describeContent({ kind: 'image', body: 'look', payload: { path: 't/1.jpg' } })).toBe('[Photo: chat-images/t/1.jpg] — caption: look')
    expect(describeContent({ kind: 'runcard', payload: { title: 'Tempo', note: 'ugh' } })).toBe('[Logged run] Tempo — note: ugh')
    expect(describeContent(null)).toMatch(/reported directly/)
  })
})
