import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { CoachTitle } from '../types'

export interface CoachHit { id: string; name: string; title: CoachTitle; initials: string }
export interface TeamMember { coach_id: string; relationship: 'head' | 'assistant'; coach: { name: string; title: CoachTitle; initials: string } }

export async function searchCoaches(client: SupabaseClient, query: string): Promise<CoachHit[]> {
  const { data, error } = await client.rpc('search_coaches', { p_query: query }); if (error) throw error; return data as CoachHit[]
}
export async function fetchTeam(client: SupabaseClient, athleteId: string): Promise<TeamMember[]> {
  const { data, error } = await client.from('coach_athlete')
    .select('coach_id, relationship, coach:profiles!coach_athlete_coach_id_fkey(name,title,initials)')
    .eq('athlete_id', athleteId)
  if (error) throw error
  return data as unknown as TeamMember[]
}
export async function addAssistant(client: SupabaseClient, { coachId, athleteId }: { coachId: string; athleteId: string }) {
  const { error } = await client.from('coach_athlete').insert({ coach_id: coachId, athlete_id: athleteId, relationship: 'assistant' }); if (error) throw error
}
export async function removeAssistant(client: SupabaseClient, { coachId, athleteId }: { coachId: string; athleteId: string }) {
  const { error } = await client.from('coach_athlete').delete().eq('coach_id', coachId).eq('athlete_id', athleteId).eq('relationship', 'assistant'); if (error) throw error
}
export function useTeam(athleteId: string) { return useQuery({ queryKey: ['team', athleteId], queryFn: () => fetchTeam(supabase, athleteId) }) }
export function useSearchCoaches() { return useMutation({ mutationFn: (q: string) => searchCoaches(supabase, q) }) }
export function useAddAssistant(athleteId: string) { const qc = useQueryClient(); return useMutation({ mutationFn: (coachId: string) => addAssistant(supabase, { coachId, athleteId }), onSuccess: () => qc.invalidateQueries({ queryKey: ['team', athleteId] }) }) }
export function useRemoveAssistant(athleteId: string) { const qc = useQueryClient(); return useMutation({ mutationFn: (coachId: string) => removeAssistant(supabase, { coachId, athleteId }), onSuccess: () => qc.invalidateQueries({ queryKey: ['team', athleteId] }) }) }
