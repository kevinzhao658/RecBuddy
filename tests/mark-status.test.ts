import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'
import { admin, createAndSignIn } from './helpers'

describe('mark_workout_status RPC', () => {
  let athleteA: any, athleteB: any, workoutId: string

  beforeAll(async () => {
    athleteA = await createAndSignIn({ role: 'athlete', name: 'Marker A' })
    athleteB = await createAndSignIn({ role: 'athlete', name: 'Marker B' })
    const sql = admin()
    const { data: plan } = await sql.from('plans').insert({ athlete_id: athleteA.id }).select().single()
    const { data: w } = await sql.from('workouts').insert({
      plan_id: plan!.id, athlete_id: athleteA.id, date: '2026-06-02',
      type: 'easy', title: 'Easy Run', dist: 5, pace: '9:40/mi', status: 'planned',
    }).select().single()
    workoutId = w!.id
  })

  it('athlete marks their own workout done; only status changes', async () => {
    const { error } = await athleteA.client.rpc('mark_workout_status', { p_workout_id: workoutId, p_status: 'done' })
    expect(error).toBeNull()
    const { data } = await admin().from('workouts').select('*').eq('id', workoutId).single()
    expect(data!.status).toBe('done')
    expect(Number(data!.dist)).toBe(5) // unchanged
    expect(data!.title).toBe('Easy Run') // unchanged
  })

  it('athlete cannot mark someone else workout', async () => {
    const { error } = await athleteB.client.rpc('mark_workout_status', { p_workout_id: workoutId, p_status: 'done' })
    expect(error).not.toBeNull()
  })

  it('athlete has no direct UPDATE on workouts', async () => {
    const { data } = await athleteA.client.from('workouts').update({ dist: 99 }).eq('id', workoutId).select()
    expect(data ?? []).toEqual([]) // policy removed in Task 4 -> no rows updated
    const fresh = await admin().from('workouts').select('dist').eq('id', workoutId).single()
    expect(Number(fresh.data!.dist)).toBe(5)
  })
})
