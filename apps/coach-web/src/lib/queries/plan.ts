import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Workout } from '../types'
import { weekDates, addDays } from '../week'

/** Returns a 7-slot array (Mon..Sun); null for empty days. */
export async function fetchWeek(client: SupabaseClient, athleteId: string, monday: string): Promise<(Workout | null)[]> {
  const dates = weekDates(monday)
  const { data, error } = await client.from('workouts').select('*')
    .eq('athlete_id', athleteId).gte('date', dates[0]).lte('date', dates[6])
  if (error) throw error
  const byDate = new Map((data as Workout[]).map((w) => [w.date, w]))
  return dates.map((d) => byDate.get(d) ?? null)
}
export function useAthletePlan(athleteId: string | null, monday: string) {
  return useQuery({
    queryKey: ['week', athleteId, monday],
    queryFn: () => fetchWeek(supabase, athleteId!, monday),
    enabled: !!athleteId,
  })
}
export function planQueryKey(athleteId: string | null, monday: string) { return ['week', athleteId, monday] as const }

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

export async function upsertWorkout(
  client: SupabaseClient,
  athleteId: string,
  date: string,
  draft: WorkoutDraft,
): Promise<void> {
  const planId = await getOrCreatePlanId(client, athleteId)
  const status = draft.type === 'rest' ? 'rest' : 'planned'
  const { error } = await client.from('workouts').upsert(
    { plan_id: planId, athlete_id: athleteId, date, ...draft, status },
    { onConflict: 'athlete_id,date' },
  )
  if (error) throw error
}

export function useUpsertWorkout(athleteId: string, monday: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ date, draft }: { date: string; draft: WorkoutDraft }) => upsertWorkout(supabase, athleteId, date, draft),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['week', athleteId, monday] }),
  })
}
export function useClearDay(athleteId: string, monday: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (date: string) => { const { error } = await supabase.from('workouts').delete().eq('athlete_id', athleteId).eq('date', date); if (error) throw error },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['week', athleteId, monday] }),
  })
}

/** Move a workout from one date to another; if the target has a workout, swap dates.
 *  Uses a temp date to avoid the unique(athlete_id,date) collision during a swap. */
export async function moveWorkout(client: SupabaseClient, { athleteId, from, to }: { athleteId: string; from: string; to: string }): Promise<void> {
  if (from === to) return
  const { data, error } = await client.from('workouts').select('id, date').eq('athlete_id', athleteId).in('date', [from, to])
  if (error) throw error
  const rows = data as { id: string; date: string }[]
  const src = rows.find((w) => w.date === from)
  const dst = rows.find((w) => w.date === to)
  if (!src) return
  const TMP = '1900-01-01'
  const upd = (id: string, date: string) => client.from('workouts').update({ date }).eq('id', id)
  let e = (await upd(src.id, TMP)).error; if (e) throw e
  if (dst) { e = (await upd(dst.id, from)).error; if (e) throw e }
  e = (await upd(src.id, to)).error; if (e) throw e
}

export function useMoveWorkout(athleteId: string, monday: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { from: string; to: string }) => moveWorkout(supabase, { athleteId, ...args }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['week', athleteId, monday] }),
  })
}

/** Paste a copied workout onto a date (creating the plan if needed). */
export async function pasteWorkout(client: SupabaseClient, athleteId: string, date: string, source: Workout): Promise<void> {
  const planId = await getOrCreatePlanId(client, athleteId)
  const status = source.type === 'rest' ? 'rest' : 'planned'
  const { error } = await client.from('workouts').upsert(
    { plan_id: planId, athlete_id: athleteId, date, type: source.type, title: source.title, dist: source.dist, pace: source.pace,
      est_minutes: source.est_minutes, dur: source.dur, note: source.note, sets: source.sets, status },
    { onConflict: 'athlete_id,date' },
  )
  if (error) throw error
}

export function usePasteWorkout(athleteId: string, monday: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ date, source }: { date: string; source: Workout }) => pasteWorkout(supabase, athleteId, date, source),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['week', athleteId, monday] }),
  })
}

/** Copy each workout in [monday..sun] into the following week (date + 7), status reset. */
export async function duplicateWeek(client: SupabaseClient, athleteId: string, monday: string): Promise<void> {
  const dates = weekDates(monday)
  const planId = await getOrCreatePlanId(client, athleteId)
  const { data, error } = await client.from('workouts').select('*').eq('athlete_id', athleteId).gte('date', dates[0]).lte('date', dates[6])
  if (error) throw error
  const rows = (data as Workout[]).map((w) => ({
    plan_id: planId, athlete_id: athleteId, date: addDays(w.date, 7), type: w.type, title: w.title,
    dist: w.dist, pace: w.pace, est_minutes: w.est_minutes, dur: w.dur, note: w.note, sets: w.sets,
    status: w.type === 'rest' ? 'rest' : 'planned',
  }))
  if (rows.length) { const { error: upErr } = await client.from('workouts').upsert(rows, { onConflict: 'athlete_id,date' }); if (upErr) throw upErr }
}
export function useDuplicateWeek(athleteId: string, monday: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => duplicateWeek(supabase, athleteId, monday),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['week', athleteId] }),
  })
}
