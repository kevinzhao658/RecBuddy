import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'

/** Invalidate the selected athlete's queries when their data changes:
 *  workouts -> the week grid; plans -> the roster (goal race/dates/week label);
 *  workout_actuals -> the Results panel (logged runs + the athlete's comment),
 *  so athlete-side edits show here without a reload. */
export function useRealtimePlan(athleteId: string | null) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!athleteId) return
    const ch = supabase.channel(`plan:${athleteId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workouts', filter: `athlete_id=eq.${athleteId}` },
        () => qc.invalidateQueries({ queryKey: ['week', athleteId] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plans', filter: `athlete_id=eq.${athleteId}` },
        () => qc.invalidateQueries({ queryKey: ['roster'] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workout_actuals', filter: `athlete_id=eq.${athleteId}` },
        () => qc.invalidateQueries({ queryKey: ['actual'] }))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [athleteId, qc])
}
