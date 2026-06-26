import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../supabase'
import type { Profile, CoachTitle } from '../types'

/** The signed-in coach's own profile (name/initials/title for the sidebar). */
export async function fetchMe(): Promise<Profile | null> {
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', u.user.id).single()
  return (data as Profile) ?? null
}

export function useMe() {
  return useQuery({ queryKey: ['me'], queryFn: fetchMe })
}

/** Update the signed-in coach's own profile (RLS: profiles_self_update). */
export async function updateProfile(patch: { name?: string; title?: CoachTitle; avatar_url?: string | null }): Promise<void> {
  const { data: u } = await supabase.auth.getUser()
  const { error } = await supabase.from('profiles').update(patch).eq('id', u.user!.id)
  if (error) throw error
}
export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })
}

/** Upload the coach's photo to the `avatars` bucket (own-folder RLS) and save
 *  its public URL on the profile. A cache-busting `?v=` forces the new image to
 *  load since the storage path (`<uid>/avatar`) is reused on every upload. */
export async function uploadAvatar(file: File): Promise<string> {
  const { data: u } = await supabase.auth.getUser()
  const path = `${u.user!.id}/avatar`
  const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true, contentType: file.type })
  if (upErr) throw upErr
  const url = `${supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl}?v=${Date.now()}`
  await updateProfile({ avatar_url: url })
  return url
}
export function useUploadAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: uploadAvatar,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['me'] }),
  })
}
