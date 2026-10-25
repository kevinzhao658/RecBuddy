import type { Reaction, ReactionKind } from './types'

/** The five reactions, canonical order everywhere (iOS + web + DB check). */
export const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: 'like', emoji: '👍', label: 'Like' },
  { kind: 'emphasize', emoji: '‼️', label: 'Emphasize' },
  { kind: 'question', emoji: '❓', label: 'Question' },
  { kind: 'laugh', emoji: '😂', label: 'Laugh' },
  { kind: 'congrats', emoji: '🎉', label: 'Congratulate' },
]

export type ReactionSummary = { kind: ReactionKind; emoji: string; label: string; count: number; mine: boolean; names: string[] }

/** Used reactions on one message, grouped by kind in canonical order. A person
 *  can hold several kinds (one of each). */
export function summarize(rs: Reaction[], messageId: string, meId: string, nameFor: (userId: string) => string): ReactionSummary[] {
  const live = rs.filter((r) => r.message_id === messageId && r.kind && r.active !== false)
  return REACTIONS.flatMap((def) => {
    const of = live.filter((r) => r.kind === def.kind)
    if (!of.length) return []
    return [{ ...def, count: of.length, mine: of.some((r) => r.user_id === meId), names: of.map((r) => nameFor(r.user_id)) }]
  })
}
