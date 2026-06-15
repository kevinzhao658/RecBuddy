import { useQuery } from '@tanstack/react-query'
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
