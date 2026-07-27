import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Workout } from '../types'
import { weekDates, addDays, monthGridDates } from '../week'

/** Returns a 7-slot array (Mon..Sun); each slot holds that day's workouts ordered by created_at. */
export async function fetchWeek(client: SupabaseClient, athleteId: string, monday: string): Promise<Workout[][]> {
  const dates = weekDates(monday)
  const { data, error } = await client.from('workouts').select('*')
    .eq('athlete_id', athleteId).gte('date', dates[0]).lte('date', dates[6])
    .order('created_at')
  if (error) throw error
  const byDate = new Map<string, Workout[]>(dates.map((d) => [d, []]))
  for (const w of data as Workout[]) byDate.get(w.date)?.push(w)
  return dates.map((d) => byDate.get(d)!)
}
export function useAthletePlan(athleteId: string | null, monday: string) {
  return useQuery({
    queryKey: ['week', athleteId, monday],
    queryFn: () => fetchWeek(supabase, athleteId!, monday),
    enabled: !!athleteId,
  })
}
export function planQueryKey(athleteId: string | null, monday: string) { return ['week', athleteId, monday] as const }

/** Workouts for a whole calendar-month grid, keyed by date (each day's list ordered by created_at). */
export async function fetchMonth(client: SupabaseClient, athleteId: string, anchor: string): Promise<Record<string, Workout[]>> {
  const dates = monthGridDates(anchor)
  const { data, error } = await client.from('workouts').select('*')
    .eq('athlete_id', athleteId).gte('date', dates[0]).lte('date', dates[dates.length - 1])
    .order('created_at')
  if (error) throw error
  const byDate: Record<string, Workout[]> = {}
  for (const w of data as Workout[]) (byDate[w.date] ??= []).push(w)
  return byDate
}
export function useAthleteMonth(athleteId: string | null, anchor: string, enabled = true) {
  return useQuery({
    queryKey: ['month', athleteId, anchor],
    queryFn: () => fetchMonth(supabase, athleteId!, anchor),
    enabled: !!athleteId && enabled,
  })
}

/** Coach-side goal edit — mirrors the athlete's update_my_goal RPC, plus the
 *  training-block start date (start_date -> goal_date drives Week x of y). */
export interface GoalDraft { goalRace: string; goalDistance: string; goalDate: string; goalTime: string; startDate: string }
export function useUpdateAthleteGoal(athleteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (g: GoalDraft) => {
      const { error } = await supabase.rpc('update_athlete_goal', {
        p_athlete_id: athleteId,
        p_goal_race: g.goalRace || null,
        p_goal_distance: g.goalDistance || null,
        p_goal_date: g.goalDate || null,
        p_goal_time: g.goalTime || null,
        p_start_date: g.startDate || null,
      })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster'] }),
  })
}

export interface WorkoutDraft {
  type: Workout['type']; title: string; dist: number | null; pace: string | null
  est_minutes: number | null; dur: number | null; note: string; sets: [string, string][]
}
export async function getOrCreatePlanId(client: SupabaseClient, athleteId: string): Promise<string> {
  const { data: existing, error } = await client.from('plans').select('id').eq('athlete_id', athleteId).limit(1).maybeSingle()
  if (error) throw error
  if (existing) return existing.id
  const { data: created, error: insErr } = await client.from('plans').insert({ athlete_id: athleteId }).select('id').single()
  if (insErr) throw insErr
  return created!.id
}

/** Save a workout: update the row when `workoutId` is given, otherwise insert a
 *  new one on that date (days can hold any number of workouts). */
export async function saveWorkout(
  client: SupabaseClient,
  athleteId: string,
  date: string,
  draft: WorkoutDraft,
  workoutId?: string,
): Promise<void> {
  const status = draft.type === 'rest' ? 'rest' : 'planned'
  if (workoutId) {
    const { error } = await client.from('workouts').update({ date, ...draft, status }).eq('id', workoutId)
    if (error) throw error
    return
  }
  const planId = await getOrCreatePlanId(client, athleteId)
  const { error } = await client.from('workouts').insert({ plan_id: planId, athlete_id: athleteId, date, ...draft, status })
  if (error) throw error
}

export function useUpsertWorkout(athleteId: string, monday: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ date, draft, id }: { date: string; draft: WorkoutDraft; id?: string | null }) =>
      saveWorkout(supabase, athleteId, date, draft, id ?? undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['week', athleteId, monday] })
      qc.invalidateQueries({ queryKey: ['month', athleteId] })
    },
  })
}

export async function deleteWorkout(client: SupabaseClient, workoutId: string): Promise<void> {
  const { error } = await client.from('workouts').delete().eq('id', workoutId)
  if (error) throw error
}
export function useDeleteWorkout(athleteId: string, monday: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (workoutId: string) => deleteWorkout(supabase, workoutId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['week', athleteId, monday] })
      qc.invalidateQueries({ queryKey: ['month', athleteId] })
    },
  })
}

/** Move a workout to another date. Moving onto an occupied day appends. */
export async function moveWorkout(client: SupabaseClient, workoutId: string, toDate: string): Promise<void> {
  const { error } = await client.from('workouts').update({ date: toDate }).eq('id', workoutId)
  if (error) throw error
}

export function useMoveWorkout(athleteId: string, monday: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) => moveWorkout(supabase, id, to),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['week', athleteId, monday] })
      qc.invalidateQueries({ queryKey: ['month', athleteId] })
    },
  })
}

/** Paste a copied workout onto a date (creating the plan if needed). Pasting
 *  onto an occupied day ADDS a workout. */
export async function pasteWorkout(client: SupabaseClient, athleteId: string, date: string, source: Workout): Promise<void> {
  const planId = await getOrCreatePlanId(client, athleteId)
  const status = source.type === 'rest' ? 'rest' : 'planned'
  const { error } = await client.from('workouts').insert(
    { plan_id: planId, athlete_id: athleteId, date, type: source.type, title: source.title, dist: source.dist, pace: source.pace,
      est_minutes: source.est_minutes, dur: source.dur, note: source.note, sets: source.sets, status },
  )
  if (error) throw error
}

export function usePasteWorkout(athleteId: string, monday: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ date, source }: { date: string; source: Workout }) => pasteWorkout(supabase, athleteId, date, source),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['week', athleteId, monday] })
      qc.invalidateQueries({ queryKey: ['month', athleteId] })
    },
  })
}

/** Copy each workout in [monday..sun] into the following week (date + 7), status
 *  reset. Plain insert — appends to whatever the target week already holds. */
export async function duplicateWeek(client: SupabaseClient, athleteId: string, monday: string): Promise<void> {
  const dates = weekDates(monday)
  const planId = await getOrCreatePlanId(client, athleteId)
  const { data, error } = await client.from('workouts').select('*')
    .eq('athlete_id', athleteId).gte('date', dates[0]).lte('date', dates[6]).order('created_at')
  if (error) throw error
  const rows = (data as Workout[]).map((w) => ({
    plan_id: planId, athlete_id: athleteId, date: addDays(w.date, 7), type: w.type, title: w.title,
    dist: w.dist, pace: w.pace, est_minutes: w.est_minutes, dur: w.dur, note: w.note, sets: w.sets,
    status: w.type === 'rest' ? 'rest' : 'planned',
  }))
  if (rows.length) { const { error: insErr } = await client.from('workouts').insert(rows); if (insErr) throw insErr }
}
export function useDuplicateWeek(athleteId: string, monday: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => duplicateWeek(supabase, athleteId, monday),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['week', athleteId] })
      qc.invalidateQueries({ queryKey: ['month', athleteId] })
    },
  })
}
