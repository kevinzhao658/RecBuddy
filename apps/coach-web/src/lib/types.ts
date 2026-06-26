export type Role = 'coach' | 'athlete'
export type WorkoutType = 'easy' | 'long' | 'speed' | 'tempo' | 'recovery' | 'cross' | 'rest' | 'race'
export type WorkoutStatus = 'done' | 'today' | 'planned' | 'missed' | 'rest'
export type CoachTitle = 'Head Coach' | 'Assistant Coach' | 'Strength Coach' | 'Physio'

export interface Profile {
  id: string; role: Role; name: string; email: string; initials: string
  experience_level: string | null; primary_goal: string | null; title: CoachTitle | null
  avatar_url: string | null
}
export interface Plan {
  id: string; athlete_id: string; goal_race: string | null; goal_date: string | null
  goal_distance: string | null; goal_time: string | null; goal_pace: string | null
  plan_week: number; plan_weeks: number; status: 'On track' | 'Crushing it' | 'Needs check-in'
}
export interface Workout {
  id: string; plan_id: string; athlete_id: string; date: string; type: WorkoutType
  title: string; dist: number | null; pace: string | null; est_minutes: number | null
  dur: number | null; note: string | null; sets: [string, string][]; status: WorkoutStatus
}
export interface LibraryWorkout {
  id: string; coach_id: string; type: WorkoutType; title: string; dist: number | null
  pace: string | null; est_minutes: number | null; note: string | null; sets: [string, string][]; custom: boolean
}
export interface Invite {
  id: string; code: string; coach_id: string; athlete_name: string | null; consumed_at: string | null
  goal_race: string | null; goal_distance: string | null; goal_date: string | null; goal_time: string | null
}
export interface RosterEntry { relationship: 'head' | 'assistant'; athlete: Profile; plans: Plan[] }

export type MessageKind = 'text' | 'runcard' | 'adjust' | 'workout'
/** payload for kind='runcard' (a completed run the athlete logged). */
export interface RunCard { title: string; dist: string; pace: string; time: string; hr: number }
/** payload for kind='adjust' (a workout change the coach pushed). */
export interface AdjustCard { from: string; to: string; reason: string }
/** payload for kind='workout' (a scheduled workout the coach shared). Snapshot
 *  for display; the message's workout_id links the live row for click-through. */
export interface WorkoutCard { date: string; type: WorkoutType; title: string; dist: number | null; pace: string | null }
export interface Thread { id: string; athlete_id: string; coach_id: string }
export interface Message {
  id: string; thread_id: string; from_user_id: string; kind: MessageKind
  body: string | null; payload: RunCard | AdjustCard | WorkoutCard | null
  workout_id: string | null; read: boolean; created_at: string
}
