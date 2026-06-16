import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/** Invalidate the selected athlete's week queries when their workouts change. */
export function useRealtimePlan(athleteId: string | null) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!athleteId) return
    const ch = supabase.channel(`workouts:${athleteId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workouts', filter: `athlete_id=eq.${athleteId}` },
        () => qc.invalidateQueries({ queryKey: ['week', athleteId] }))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [athleteId, qc])
}
