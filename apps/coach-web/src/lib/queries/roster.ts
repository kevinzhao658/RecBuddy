import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { RosterEntry } from '../types'

export async function fetchRoster(client: SupabaseClient): Promise<RosterEntry[]> {
  const { data, error } = await client
    .from('coach_athlete')
    .select('relationship, athlete:profiles!coach_athlete_athlete_id_fkey(*, plans(*))')
    .order('relationship')
  if (error) throw error
  return (data as any[]).map((r) => ({
    relationship: r.relationship,
    athlete: r.athlete,
    plans: r.athlete?.plans ?? [],
  }))
}

export function useRoster() {
  return useQuery({ queryKey: ['roster'], queryFn: () => fetchRoster(supabase) })
}

export function useRemoveAthlete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ coachId, athleteId }: { coachId: string; athleteId: string }) => {
      const { error } = await supabase.from('coach_athlete').delete().eq('coach_id', coachId).eq('athlete_id', athleteId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster'] }),
  })
}
