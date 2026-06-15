import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Workout } from '../types'
import { weekDates } from '../week'

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
