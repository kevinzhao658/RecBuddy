import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useConversations } from '../../lib/queries/conversations'
import type { Workout } from '../../lib/types'
import { RosterSidebar } from '../roster/RosterSidebar'
import { ConversationList } from './ConversationList'
import { ThreadView } from './ThreadView'
import { ComposePane } from './ComposePane'
import { ConversationInfo } from './ConversationInfo'

type NavState = { workout?: Pick<Workout, 'id' | 'date' | 'type' | 'title'> } | null

/** /coach/messages[/:threadId] — every conversation on the left, the open one on the right. */
export function MessagesPage() {
  const { session } = useAuth()
  const meId = session!.user.id
  const { threadId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const conversations = useConversations(meId)
  const [composing, setComposing] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const rows = conversations.data ?? []
  const open = threadId ? rows.find((c) => c.thread_id === threadId) ?? null : null
  const workout = (location.state as NavState)?.workout ?? null

  const select = (id: string) => { setComposing(false); setInfoOpen(false); navigate(`/coach/messages/${id}`) }
  // Workout cards in a team chat open that athlete's day on the plan.
  const openDay = open?.team_athlete_id
    ? (date: string, workoutId?: string) => navigate('/coach', { state: { athleteId: open.team_athlete_id, date, workoutId } })
    : undefined

  return (
    <div className="flex h-screen min-h-0">
      <div className="hidden md:flex">
        <RosterSidebar selectedId={null} messagesActive onSelect={(id) => navigate('/coach', { state: { athleteId: id } })} />
      </div>
      <div className={`${threadId || composing ? 'hidden md:flex' : 'flex'} w-full flex-col border-r border-line md:w-80`}>
        <ConversationList conversations={rows} selectedId={threadId ?? null} meId={meId}
          onSelect={select} onCompose={() => { setComposing(true); navigate('/coach/messages') }} />
      </div>
      <main className={`${threadId || composing ? 'flex' : 'hidden md:flex'} min-w-0 flex-1`}>
        {composing
          ? <ComposePane onOpen={select} onCancel={() => setComposing(false)} />
          : threadId
            ? <ThreadView key={threadId} threadId={threadId} conversation={open} onOpenDay={openDay}
                initialWorkout={workout} onInfo={open ? () => setInfoOpen((o) => !o) : undefined} />
            : <div className="grid flex-1 place-items-center text-sm text-text-mute">Select a conversation</div>}
        {infoOpen && open && !composing && (
          <ConversationInfo key={open.thread_id} conversation={open} onClose={() => setInfoOpen(false)}
            onOpenThread={select} onGone={() => { setInfoOpen(false); navigate('/coach/messages') }} />
        )}
      </main>
    </div>
  )
}
