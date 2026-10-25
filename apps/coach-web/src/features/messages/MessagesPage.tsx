import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../auth/AuthProvider'
import { useConversations, usePendingConversation } from '../../lib/queries/conversations'
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
  const [rosterOpen, setRosterOpen] = useState(false)
  const rows = conversations.data ?? []
  const listed = threadId ? rows.find((c) => c.thread_id === threadId) ?? null : null
  // A chat with no messages yet isn't in the inbox; build its header from the thread.
  const pending = usePendingConversation(threadId && conversations.isSuccess && !listed ? threadId : null, meId)
  const open = listed ?? pending
  // "Message athlete about this workout": attach it to the thread it was
  // handed to, once. Clearing the history entry stops reload / Back from
  // attaching it again.
  const [handoff, setHandoff] = useState(() => {
    const w = (location.state as NavState)?.workout
    return w && threadId ? { threadId, workout: w } : null
  })
  const workout = handoff && handoff.threadId === threadId ? handoff.workout : null
  useEffect(() => { if (handoff && handoff.threadId !== threadId) setHandoff(null) }, [handoff, threadId])
  useEffect(() => {
    if ((location.state as NavState)?.workout) navigate(location.pathname, { replace: true, state: null })
  }, [location.state, location.pathname, navigate])

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
      {/* Phones: the roster as a drawer, opened from the inbox header */}
      {rosterOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRosterOpen(false)} />
          <div className="fixed inset-y-0 left-0 z-40">
            <RosterSidebar selectedId={null} messagesActive onSelect={(id) => navigate('/coach', { state: { athleteId: id } })} />
          </div>
        </div>
      )}
      <div className={`${threadId || composing ? 'hidden md:flex' : 'flex'} w-full flex-col border-r border-line md:w-80`}>
        <ConversationList conversations={rows} selectedId={threadId ?? null} meId={meId}
          onSelect={select} onCompose={() => { setComposing(true); navigate('/coach/messages') }}
          onMenu={() => setRosterOpen(true)} />
      </div>
      <main className={`${threadId || composing ? 'flex' : 'hidden md:flex'} min-w-0 flex-1`}>
        {composing
          ? <ComposePane onOpen={select} onCancel={() => setComposing(false)} />
          : threadId
            ? <ThreadView key={threadId} threadId={threadId} conversation={open} onOpenDay={openDay}
                initialWorkout={workout} onInfo={open ? () => setInfoOpen((o) => !o) : undefined}
                onGone={() => { setInfoOpen(false); navigate('/coach/messages') }}
                onBack={() => { setInfoOpen(false); navigate('/coach/messages') }} />
            : <div className="grid flex-1 place-items-center text-sm text-text-mute">Select a conversation</div>}
        {infoOpen && open && !composing && (
          <ConversationInfo key={open.thread_id} conversation={open} onClose={() => setInfoOpen(false)}
            onOpenThread={select} onGone={() => { setInfoOpen(false); navigate('/coach/messages') }} />
        )}
      </main>
    </div>
  )
}
