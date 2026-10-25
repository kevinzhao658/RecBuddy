export type Role = 'coach' | 'athlete'
export type WorkoutType = 'easy' | 'long' | 'speed' | 'tempo' | 'recovery' | 'cross' | 'rest' | 'race' | 'other'
export type WorkoutStatus = 'done' | 'today' | 'planned' | 'missed' | 'rest'
export type CoachTitle = 'Head Coach' | 'Assistant Coach' | 'Strength Coach' | 'Physio'

export interface Profile {
  id: string; role: Role; name: string; email: string; initials: string
  /** Dual-role flags — permission gates use these; `role` is the primary/display role. */
  is_coach: boolean; is_athlete: boolean
  experience_level: string | null; primary_goal: string | null; title: CoachTitle | null
  avatar_url: string | null
}
export interface Plan {
  id: string; athlete_id: string; goal_race: string | null; goal_date: string | null
  goal_distance: string | null; goal_time: string | null; goal_pace: string | null
  /** Training-block start; Week x of y derives from start_date -> goal_date. */
  start_date: string | null
  plan_week: number; plan_weeks: number; status: 'On track' | 'Crushing it' | 'Needs check-in'
}
export interface Workout {
  id: string; plan_id: string; athlete_id: string; date: string; type: WorkoutType
  title: string; dist: number | null; pace: string | null; est_minutes: number | null
  dur: number | null; note: string | null; sets: [string, string][]; status: WorkoutStatus
}
/** An athlete-logged result for a workout (workout_actuals row). */
export interface Actual {
  id: string; workout_id: string | null; athlete_id: string; dist: number | null
  pace: string | null; time: string | null; hr: number | null; feel: number | null
  note: string | null; source: string; source_id: string | null; recorded_at: string
  /** Declared sport ('run' | 'ride' | 'swim'); null on legacy rows (readers fall back to pace inference). */
  activity: string | null
  /** Average power for rides (watts); manual entry or Health sync, usually null. */
  avg_watts: number | null
}
export interface LibraryWorkout {
  id: string; coach_id: string; type: WorkoutType; title: string; dist: number | null
  pace: string | null; est_minutes: number | null; note: string | null; sets: [string, string][]; custom: boolean
}
export interface Invite {
  id: string; code: string; coach_id: string; athlete_name: string | null; consumed_at: string | null
  goal_race: string | null; goal_distance: string | null; goal_date: string | null; goal_time: string | null
  goal_start_date: string | null
}
export type CoachPermission = 'read' | 'edit' | 'admin'
/** `permission` is the SIGNED-IN coach's access to this athlete (read/edit/admin). */
export interface RosterEntry { relationship: 'head' | 'assistant'; permission: CoachPermission; athlete: Profile; plans: Plan[] }

export type MessageKind = 'text' | 'runcard' | 'adjust' | 'workout' | 'image'
/** payload for kind='runcard' (a completed run the athlete logged). `date`
 *  (new shares) enables click-through to the day's results-vs-plan view;
 *  `type` drives the type icon so the card matches shared-workout cards. */
export interface RunCard { title: string; dist: string; pace: string; time: string; hr: number; date?: string; type?: WorkoutType; note?: string }
/** payload for kind='adjust' (a workout change the coach pushed). */
export interface AdjustCard { from: string; to: string; reason: string }
/** payload for kind='workout' (a scheduled workout the coach shared). Snapshot
 *  for display; the message's workout_id links the live row for click-through. */
export interface WorkoutCard { date: string; type: WorkoutType; title: string; dist: number | null; pace: string | null }
/** payload for kind='image' (a client-compressed JPEG uploaded to chat-images).
 *  `path` is the canonical storage path (<thread_id>/<uuid>.jpg) — clients exchange
 *  it for a short-lived signed URL via the private bucket.
 *  `url` is legacy-read-only (old public-bucket rows); never written to new rows. */
export interface ImageCard { path?: string; url?: string; w: number; h: number }
/** payload for a kind='text' message about a workout ("Message … about this");
 *  the message's workout_id links the live row. */
export interface WorkoutQuote { quote: 'workout'; title: string; date: string; type: WorkoutType }
export interface Thread { id: string; athlete_id: string; coach_id: string }
export interface Message {
  id: string; thread_id: string; from_user_id: string; kind: MessageKind
  body: string | null; payload: RunCard | AdjustCard | WorkoutCard | ImageCard | WorkoutQuote | null
  workout_id: string | null; read: boolean; created_at: string
  /** Quote-reply target (same thread). */
  reply_to_id?: string | null
}

// ── Conversations + reactions (mirror iOS Lib/Conversations.swift) ──────────
export interface ConversationMember { user_id: string; name: string; initials: string; avatar_url: string | null }
/** One inbox row (my_conversations). */
export interface Conversation {
  thread_id: string; kind: 'team' | 'chat'; title: string | null; team_athlete_id: string | null
  members: ConversationMember[]; last_body: string | null; last_kind: MessageKind | null
  last_from: string | null; last_at: string | null; unread: number; read_only: boolean
}
/** search_chat_people row. */
export interface ChatPerson {
  user_id: string; name: string; initials: string; avatar_url: string | null
  person_kind: 'coach' | 'athlete'; context: string
}
/** thread_people row: anyone who can appear as a sender in a thread. */
/** thread_people row; current = still in the conversation (people who left keep a name on old messages). */
export interface ThreadPerson { user_id: string; name: string; initials: string; avatar_url: string | null; title: string | null; current?: boolean }
export type ReactionKind = 'like' | 'emphasize' | 'question' | 'laugh' | 'congrats'
/** message_reactions row: one per person per kind; active false = removed. */
export interface Reaction { message_id: string; user_id: string; kind: ReactionKind; active?: boolean }
