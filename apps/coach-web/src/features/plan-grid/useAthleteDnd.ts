import { useState } from 'react'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import type { Workout, LibraryWorkout } from '../../lib/types'

/**
 * Drag-and-drop wiring for the week grid: tracks the active drag, resolves the
 * ghost card, and routes a drop to either "paste a library template onto a day"
 * (id `lib:<id>`) or "move a workout between days" (id = ISO date).
 */
export function useAthleteDnd({ week, library, onPasteTemplate, onMove }: {
  week: (Workout | null)[]
  library: LibraryWorkout[] | undefined
  onPasteTemplate: (date: string, tpl: Workout) => void
  onMove: (from: string, to: string) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const activeGhost = activeId
    ? activeId.startsWith('lib:')
      ? (library ?? []).find((t) => `lib:${t.id}` === activeId) ?? null
      : week.find((w) => w?.date === activeId) ?? null
    : null

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id))
  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null)
    const from = String(e.active.id)
    const to = e.over ? String(e.over.id) : null
    if (!to) return
    if (from.startsWith('lib:')) {
      const tpl = (library ?? []).find((t) => `lib:${t.id}` === from)
      if (tpl) onPasteTemplate(to, tpl as unknown as Workout)
    } else if (from !== to) {
      onMove(from, to)
    }
  }

  return { activeGhost, onDragStart, onDragEnd }
}
