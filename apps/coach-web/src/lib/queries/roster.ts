import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { RosterEntry } from '../types'

export async function fetchRoster(client: SupabaseClient): Promise<RosterEntry[]> {
  // Scope to THIS coach's own links. RLS also exposes other coaches' rows for
  // athletes you coach (head + assistants), which would list the same athlete
  // more than once — and the PK is (coach_id, athlete_id), so filtering by the
  // current coach yields exactly one row per athlete (no duplicate React keys).
  const { data: who } = await client.auth.getUser()
  const { data, error } = await client
    .from('coach_athlete')
    .select('relationship, athlete:profiles!coach_athlete_athlete_id_fkey(*, plans(*))')
    .eq('coach_id', who.user!.id)
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
