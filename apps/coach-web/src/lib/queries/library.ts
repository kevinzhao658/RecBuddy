import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { LibraryWorkout, WorkoutType } from '../types'

export interface LibraryDraft {
  type: WorkoutType; title: string; dist: number | null; pace: string | null
  note: string | null; sets: [string, string][]
}

export async function fetchLibrary(client: SupabaseClient): Promise<LibraryWorkout[]> {
  const { data, error } = await client.from('library_workouts').select('*').order('created_at')
  if (error) throw error
  return data as LibraryWorkout[]
}
export async function createLibraryWorkout(client: SupabaseClient, draft: LibraryDraft) {
  const { data: me } = await client.auth.getUser()
  const { error } = await client.from('library_workouts').insert({ ...draft, coach_id: me.user!.id, custom: true })
  if (error) throw error
}
export async function updateLibraryWorkout(client: SupabaseClient, id: string, patch: Partial<LibraryDraft>) {
  const { error } = await client.from('library_workouts').update(patch).eq('id', id)
  if (error) throw error
}
export async function deleteLibraryWorkout(client: SupabaseClient, id: string) {
  const { error } = await client.from('library_workouts').delete().eq('id', id)
  if (error) throw error
}

export function useLibrary() { return useQuery({ queryKey: ['library'], queryFn: () => fetchLibrary(supabase) }) }
export function useCreateLibraryWorkout() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (d: LibraryDraft) => createLibraryWorkout(supabase, d), onSuccess: () => qc.invalidateQueries({ queryKey: ['library'] }) })
}
export function useUpdateLibraryWorkout() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: ({ id, patch }: { id: string; patch: Partial<LibraryDraft> }) => updateLibraryWorkout(supabase, id, patch), onSuccess: () => qc.invalidateQueries({ queryKey: ['library'] }) })
}
export function useDeleteLibraryWorkout() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (id: string) => deleteLibraryWorkout(supabase, id), onSuccess: () => qc.invalidateQueries({ queryKey: ['library'] }) })
}
