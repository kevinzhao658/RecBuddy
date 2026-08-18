import { useQuery } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Actual } from '../types'

/** The athlete's logged result for a workout (RLS: coach of the athlete can
 *  read). Newest-first so any legacy duplicate rows resolve to the latest log. */
export async function fetchActual(client: SupabaseClient, workoutId: string): Promise<Actual | null> {
  const { data, error } = await client.from('workout_actuals')
    .select('*').eq('workout_id', workoutId)
    .order('recorded_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return (data as Actual) ?? null
}

export function useActual(workoutId: string | null) {
  return useQuery({
    queryKey: ['actual', workoutId],
    queryFn: () => fetchActual(supabase, workoutId!),
    enabled: !!workoutId,
  })
}

/** Off-plan "extra" activities (workout_id null) for [fromIso, toIso) — a
 *  padded UTC range; callers bucket by localDayOf(recorded_at). */
export async function fetchStandaloneActuals(
  client: SupabaseClient, athleteId: string, fromIso: string, toIso: string,
): Promise<Actual[]> {
  const { data, error } = await client.from('workout_actuals')
    .select('*').eq('athlete_id', athleteId).is('workout_id', null)
    .gte('recorded_at', fromIso + 'T00:00:00Z').lt('recorded_at', toIso + 'T00:00:00Z')
    .order('recorded_at')
  if (error) throw error
  return (data as Actual[]) ?? []
}

export function useStandaloneActuals(athleteId: string | null, fromIso: string, toIso: string) {
  return useQuery({
    queryKey: ['standalone', athleteId, fromIso, toIso],
    queryFn: () => fetchStandaloneActuals(supabase, athleteId!, fromIso, toIso),
    enabled: !!athleteId,
  })
}
