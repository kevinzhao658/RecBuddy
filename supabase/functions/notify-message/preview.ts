// ── preview: message kind -> notification content (pure; mirrors the spec table) ──
export function preview(kind: string, body: string | null, payload: Record<string, unknown> | null, coach: string) {
  switch (kind) {
    case 'image':   return { title: coach, body: 'Sent a photo' }
    case 'video':   return { title: coach, body: 'Sent a video' }
    case 'workout': return { title: coach, body: `Shared a workout: ${payload?.title ?? 'workout'}` }
    case 'adjust':  return { title: coach, body: `Adjusted your plan: ${payload?.from ?? ''} → ${payload?.to ?? ''}` }
    default:        return { title: coach, body: (body ?? '').slice(0, 120) || 'New message' }
  }
}
