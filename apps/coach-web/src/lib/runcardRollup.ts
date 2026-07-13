import type { Message } from './types'

/** Kinds that reference a live workout row and may be re-shared after edits. */
const ROLLUP_KINDS = new Set(['runcard', 'workout'])

/** Ids of workout-reference cards SUPERSEDED by a newer card of the SAME kind
 *  for the same workout (re-logged runs, re-shared prescriptions). The chat
 *  renders these as a rolled-up placeholder so one workout doesn't stack a
 *  pile of full cards. A runcard never supersedes a workout card (result vs
 *  prescription). Messages must be in created_at order; cards without
 *  workout_id (legacy) are never rolled up. */
export function supersededCardIds(messages: Message[]): Set<string> {
  const latest = new Map<string, string>() // `${kind}:${workout_id}` -> newest message id
  for (const m of messages) {
    if (ROLLUP_KINDS.has(m.kind) && m.workout_id) latest.set(`${m.kind}:${m.workout_id}`, m.id)
  }
  const out = new Set<string>()
  for (const m of messages) {
    if (ROLLUP_KINDS.has(m.kind) && m.workout_id && latest.get(`${m.kind}:${m.workout_id}`) !== m.id) out.add(m.id)
  }
  return out
}
