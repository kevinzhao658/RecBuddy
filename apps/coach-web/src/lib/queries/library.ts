import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import type { LibraryWorkout } from '../types'

export async function fetchLibrary(client: SupabaseClient): Promise<LibraryWorkout[]> {
  const { data, error } = await client.from('library_workouts').select('*').order('created_at')
  if (error) throw error
  return data as LibraryWorkout[]
}
export async function createLibraryWorkout(client: SupabaseClient, t: Partial<LibraryWorkout> & { type: LibraryWorkout['type']; title: string }) {
  const { data: me } = await client.auth.getUser()
  const { error } = await client.from('library_workouts').insert({ ...t, coach_id: me.user!.id, custom: true })
  if (error) throw error
}
export function useLibrary() { return useQuery({ queryKey: ['library'], queryFn: () => fetchLibrary(supabase) }) }
export function useCreateLibraryWorkout() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: (t: Partial<LibraryWorkout> & { type: LibraryWorkout['type']; title: string }) => createLibraryWorkout(supabase, t), onSuccess: () => qc.invalidateQueries({ queryKey: ['library'] }) })
}
