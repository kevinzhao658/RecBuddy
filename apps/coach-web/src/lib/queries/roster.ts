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
    .select('relationship, permission, athlete:profiles!coach_athlete_athlete_id_fkey(*, plans(*))')
    .eq('coach_id', who.user!.id)
    .order('relationship')
  if (error) throw error
  return (data as any[]).map((r) => ({
    relationship: r.relationship,
    permission: r.permission,
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

/** A match from the existing-athlete search (by name or exact email). Emails are
 *  never returned — only display fields + whether they're already on your roster. */
export interface AthleteHit { id: string; name: string; initials: string; avatar_url: string | null; already_on_roster: boolean }

export async function searchAthletes(client: SupabaseClient, query: string): Promise<AthleteHit[]> {
  const { data, error } = await client.rpc('search_athletes', { p_query: query })
  if (error) throw error
  return data as AthleteHit[]
}
export function useSearchAthletes() {
  return useMutation({ mutationFn: (q: string) => searchAthletes(supabase, q) })
}

/** Add an existing athlete to this coach's roster with a chosen role (defaults
 *  to co-coach). Shares the athlete's plan; never overwrites their goal. */
export function useAddExistingAthlete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ athleteId, relationship }: { athleteId: string; relationship: 'head' | 'assistant' }) => {
      const { error } = await supabase.rpc('coach_add_athlete', { p_athlete_id: athleteId, p_relationship: relationship })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roster'] }),
  })
}
