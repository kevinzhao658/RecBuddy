import { useState } from 'react'
import { RosterSidebar } from '../features/roster/RosterSidebar'

export default function CoachPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  return (
    <div className="flex min-h-screen">
      <RosterSidebar selectedId={selectedId} onSelect={setSelectedId} />
      <main className="flex-1 p-6">{selectedId ? <p>Athlete {selectedId}</p> : <p className="text-text-mute">Select an athlete</p>}</main>
    </div>
  )
}
