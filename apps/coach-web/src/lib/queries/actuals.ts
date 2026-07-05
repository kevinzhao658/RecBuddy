import { useQuery } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { Actual } from '../types'

/** The athlete's logged result for a workout (RLS: coach of the athlete can read). */
export async function fetchActual(client: SupabaseClient, workoutId: string): Promise<Actual | null> {
  const { data, error } = await client.from('workout_actuals')
    .select('*').eq('workout_id', workoutId).limit(1).maybeSingle()
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
