import type { Message, RunCard, WorkoutCard, AdjustCard } from './types'
import { fmtDist, fmtPace, type Unit } from './units'

/** Plain-text forms of a chat message — what Copy puts on the clipboard and
 *  the one-line preview in reply quotes. Mirrors iOS MessageText.swift. */

/** Clipboard text, or null when there's nothing textual (an uncaptioned photo). */
export function copyText(m: Message, unit: Unit): string | null {
  switch (m.kind) {
    case 'text':
    case 'image':
      return m.body ? m.body : null
    case 'runcard': {
      const p = (m.payload ?? {}) as Partial<RunCard>
      const stats = [
        p.dist || null,
        p.pace ? fmtPace(p.pace, unit) : null,
        p.time || null,
        p.hr != null ? `Avg HR ${p.hr}` : null,
      ].filter(Boolean)
      let out = p.title ?? 'Run'
      if (stats.length) out += ' — ' + stats.join(' · ')
      if (p.note) out += `\n"${p.note}"`
      return out
    }
    case 'workout': {
      const p = (m.payload ?? {}) as Partial<WorkoutCard>
      const stats = [
        p.dist != null ? `${fmtDist(p.dist, unit)} ${unit}` : null,
        p.pace ? fmtPace(p.pace, unit) : null,
      ].filter(Boolean)
      return (p.title ?? 'Workout') + (stats.length ? ' — ' + stats.join(' · ') : '')
    }
    case 'adjust': {
      const p = (m.payload ?? {}) as Partial<AdjustCard>
      return `Workout adjusted: ${p.from ?? ''} → ${p.to ?? ''}` + (p.reason ? `\n${p.reason}` : '')
    }
    default:
      return m.body ?? null
  }
}

const oneLine = (s: string) => s.split(/\r?\n/).filter(Boolean).join(' ')

/** One-line summary for reply quotes. */
export function quotePreview(m: Message): string {
  switch (m.kind) {
    case 'image': return m.body ? `📷 ${oneLine(m.body)}` : '📷 Photo'
    case 'runcard': return `Logged run · ${(m.payload as RunCard | null)?.title ?? 'Run'}`
    case 'workout': return `Workout · ${(m.payload as WorkoutCard | null)?.title ?? 'Workout'}`
    case 'adjust': return `Workout adjusted · ${(m.payload as AdjustCard | null)?.to ?? ''}`
    default: return oneLine(m.body ?? '')
  }
}
