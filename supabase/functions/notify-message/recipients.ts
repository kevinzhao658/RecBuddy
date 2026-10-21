// Pure push-routing helpers (no Deno APIs), shared by notify-message and
// notify-reaction and unit-tested with vitest in supabase/tests.

export type ThreadInfo = { kind: string; athlete_id: string | null; title: string | null }
export type Member = { user_id: string; status: string }
export type Alert = { title: string; body: string }

/** Who gets a push for a new message.
 *  team: the athlete, unless they sent it (coaches have no devices).
 *  chat: every active member except the sender. */
export function recipients(thread: ThreadInfo, members: Member[], fromUserId: string): string[] {
  if (thread.kind === 'team') {
    return thread.athlete_id && thread.athlete_id !== fromUserId ? [thread.athlete_id] : []
  }
  return members.filter((m) => m.status === 'active' && m.user_id !== fromUserId).map((m) => m.user_id)
}

/** A named group shows its name as the title and prefixes the sender. */
export function chatAlert(thread: ThreadInfo, senderName: string, base: Alert): Alert {
  if (thread.kind === 'chat' && thread.title) {
    return { title: thread.title, body: `${senderName}: ${base.body}` }
  }
  return base
}

const EMOJI: Record<string, string> = { like: '👍', emphasize: '‼️', question: '❓', laugh: '😂', congrats: '🎉' }

export function reactionAlert(reactorName: string, kind: string): Alert {
  return { title: reactorName, body: `${EMOJI[kind] ?? '👍'} your message` }
}

/** Whether a reaction should push to the message's author: not for their own
 *  reaction, not from someone they blocked, and in a chat only while the
 *  author can still read the thread (active chat member, or the athlete/a
 *  current coach on a team thread). */
export function notifyReactionAuthor(p: {
  kind: string; authorStatus: string | null; author: string; reactor: string
  authorBlockedReactor: boolean
  /** team threads: the author is the athlete or still on their team (and not blocked by them) */
  authorCanRead: boolean
}): boolean {
  if (p.author === p.reactor || p.authorBlockedReactor) return false
  return p.kind === 'team' ? p.authorCanRead : p.authorStatus === 'active'
}
