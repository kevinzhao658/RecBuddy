import type { ChatPerson, Conversation } from './types'

const first = (name: string) => name.split(' ')[0] || name

/** Inbox / header title: the chat's name if it has one, else everyone else
 *  in it (a team chat lists its athlete first). Long lists truncate with … */
export function conversationTitle(c: Conversation): string {
  if (c.title) return c.title
  const members = c.kind === 'team'
    ? [...c.members].sort((a, b) => Number(b.user_id === c.team_athlete_id) - Number(a.user_id === c.team_athlete_id))
    : c.members
  const names = members.map((m) => m.name)
  if (names.length === 0) return c.kind === 'team' ? 'Team chat' : 'Conversation'
  if (names.length === 1) return names[0]
  const firsts = names.map(first)
  return firsts.length === 2 ? `${firsts[0]} & ${firsts[1]}` : `${firsts.slice(0, -1).join(', ')} & ${firsts[firsts.length - 1]}`
}

/** Inbox subtitle, mirrors iOS Conversation.previewLine. */
export function previewLine(c: Conversation, meId: string): string {
  let content: string
  switch (c.last_kind) {
    case null: return 'No messages yet'
    case 'image': content = c.last_body ? `📷 ${c.last_body}` : '📷 Photo'; break
    case 'runcard': content = 'Logged a run'; break
    case 'workout': content = 'Shared a workout'; break
    case 'adjust': content = 'Adjusted a workout'; break
    default: content = (c.last_body ?? '').split(/\r?\n/).filter(Boolean).join(' ')
  }
  if (c.last_from === meId) return `You: ${content}`
  if (c.members.length > 1 && c.last_from) {
    const who = c.members.find((m) => m.user_id === c.last_from)
    if (who) return `${first(who.name)}: ${content}`
  }
  return content
}

/** Add or remove a person from a To: selection. */
export function toggleIn(list: ChatPerson[], p: ChatPerson): ChatPerson[] {
  return list.some((x) => x.user_id === p.user_id) ? list.filter((x) => x.user_id !== p.user_id) : [...list, p]
}
