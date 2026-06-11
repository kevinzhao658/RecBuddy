import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const sql = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = 'recbuddy-dev' // documented dev password for every seeded user

// The trigger creates every signup as an athlete; coaches are PROMOTED here
// via the service-role client (the only path to the coach role). name/level/
// goal are non-privileged profile fields passed as user_metadata.
async function makeUser(
  email: string,
  app: { role: 'coach' | 'athlete'; title?: string },
  user: { name: string; experience_level?: string; primary_goal?: string },
) {
  // Idempotent-ish: delete an existing user with this email first.
  const { data: list } = await sql.auth.admin.listUsers()
  const existing = list.users.find((u) => u.email === email)
  if (existing) await sql.auth.admin.deleteUser(existing.id)

  const { data, error } = await sql.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true,
    user_metadata: user,
  })
  if (error) throw error
  const id = data.user!.id
  if (app.role === 'coach') {
    const { error: pErr } = await sql.from('profiles').update({ role: 'coach', title: app.title ?? null }).eq('id', id)
    if (pErr) throw pErr
  }
  return id
}

async function main() {
  // ---- coaches (promoted to the coach role via the service-role update in makeUser) ----
  const mara = await makeUser('mara@recbuddy.app', { role: 'coach', title: 'Head Coach' }, { name: 'Mara Whitlock' })
  const sam  = await makeUser('sam@recbuddy.app',  { role: 'coach', title: 'Assistant Coach' }, { name: 'Sam Okafor' })

  // ---- athletes ----
  const jordan = await makeUser('jordan@recbuddy.app', { role: 'athlete' }, { name: 'Jordan Reyes', experience_level: 'returning', primary_goal: 'pr' })
  const priya  = await makeUser('priya@recbuddy.app',  { role: 'athlete' }, { name: 'Priya Nair', experience_level: 'new', primary_goal: 'first-race' })

  // ---- roster: Mara heads both; Sam assists Jordan ----
  await sql.from('coach_athlete').insert([
    { coach_id: mara, athlete_id: jordan, relationship: 'head' },
    { coach_id: mara, athlete_id: priya, relationship: 'head' },
    { coach_id: sam,  athlete_id: jordan, relationship: 'assistant' },
  ])

  // ---- Jordan's plan (Riverside Half, week 5 of 16) ----
  const { data: plan } = await sql.from('plans').insert({
    athlete_id: jordan, goal_race: 'Riverside Half Marathon', goal_date: '2026-08-23',
    goal_distance: '13.1 mi', goal_time: '1:48:00', goal_pace: '8:14/mi',
    plan_week: 5, plan_weeks: 16, status: 'On track',
  }).select().single()
  const planId = plan!.id

  // ---- Jordan's current week (Jun 1–7, 2026) ----
  await sql.from('workouts').insert([
    { plan_id: planId, athlete_id: jordan, date: '2026-06-01', type: 'easy', title: 'Easy Run', dist: 4.5, pace: '9:40/mi', note: 'Loosen up for the week. Keep HR under 145.', sets: [], status: 'done' },
    { plan_id: planId, athlete_id: jordan, date: '2026-06-02', type: 'speed', title: '5 × 800m', dist: 6.0, pace: '7:30/mi', note: 'Big session this week. Settle into 800 rhythm — the recoveries matter as much as the reps.', sets: [['Warm-up','1.5 mi easy + 4 strides'],['5 × 800m','@ 3:45 each, 400m jog recovery'],['Cool-down','1.0 mi easy']], status: 'today' },
    { plan_id: planId, athlete_id: jordan, date: '2026-06-03', type: 'easy', title: 'Easy Run', dist: 5.0, pace: '9:45/mi', note: 'Recovery from intervals. Flat route, easy effort.', sets: [], status: 'planned' },
    { plan_id: planId, athlete_id: jordan, date: '2026-06-04', type: 'tempo', title: 'Tempo 4 mi', dist: 6.0, pace: '8:20/mi', note: 'Stretching the tempo to 4 miles. Hold form when it gets uncomfortable.', sets: [['Warm-up','1 mi easy'],['Tempo','4 mi @ 8:20/mi'],['Cool-down','1 mi easy']], status: 'planned' },
    { plan_id: planId, athlete_id: jordan, date: '2026-06-05', type: 'rest', title: 'Rest Day', sets: [], status: 'rest' },
    { plan_id: planId, athlete_id: jordan, date: '2026-06-06', type: 'long', title: 'Long Run 11 mi', dist: 11.0, pace: '9:25/mi', note: 'Longest run of the block so far. Fuel every 4 miles.', sets: [['Steady','8 mi @ 9:30/mi'],['Finish','3 mi @ goal pace 8:14/mi']], status: 'planned' },
    { plan_id: planId, athlete_id: jordan, date: '2026-06-07', type: 'cross', title: 'Cross-Train 45 min', dur: 45, note: 'Bike or swim, easy aerobic. Active recovery.', sets: [], status: 'planned' },
  ])

  // ---- one synced actual for the completed easy run ----
  const { data: easy } = await sql.from('workouts').select('id').eq('athlete_id', jordan).eq('date', '2026-06-01').single()
  await sql.from('workout_actuals').insert({
    workout_id: easy!.id, athlete_id: jordan, dist: 4.6, pace: '9:36/mi', time: '44:09', hr: 141, feel: 4, source: 'garmin',
  })

  // ---- Mara's workout library ----
  await sql.from('library_workouts').insert([
    { coach_id: mara, type: 'easy', title: 'Easy Run', dist: 5, pace: '9:45/mi', note: 'Conversational pace — keep it relaxed and honest.', sets: [], custom: false },
    { coach_id: mara, type: 'long', title: 'Long Run', dist: 10, pace: '9:30/mi', note: 'Steady aerobic effort. Fuel every 4 miles.', sets: [], custom: false },
    { coach_id: mara, type: 'speed', title: 'Intervals', dist: 6, pace: '7:30/mi', note: 'Quality session — hit your paces, respect the recoveries.', sets: [['Warm-up','1.5 mi easy'],['Reps','6 × 800m @ 3:45'],['Cool-down','1 mi easy']], custom: false },
    { coach_id: mara, type: 'tempo', title: 'Tempo Run', dist: 6, pace: '8:20/mi', note: 'Comfortably hard — your half-marathon engine work.', sets: [], custom: false },
  ])

  // ---- a message thread (Jordan ↔ Mara) ----
  const { data: thread } = await sql.from('message_threads').insert({ athlete_id: jordan, coach_id: mara }).select().single()
  await sql.from('messages').insert([
    { thread_id: thread!.id, from_user_id: mara, kind: 'text', body: 'Morning! Big long run today — 9 miles, last 2 at goal pace. Fuel around mile 5.', read: true },
    { thread_id: thread!.id, from_user_id: jordan, kind: 'runcard', payload: { title: 'Long Run 9 mi', dist: '9.1 mi', pace: '9:22/mi', time: '1:25:14', hr: 152 }, read: true },
    { thread_id: thread!.id, from_user_id: mara, kind: 'adjust', payload: { from: '6 × 400m', to: '5 × 800m @ 3:45', reason: 'Stronger threshold stimulus' }, read: true },
  ])

  // ---- one pending invite for the coach "Add athlete" demo ----
  await sql.from('invites').insert({ code: 'WELCOME-RUN', coach_id: mara, athlete_name: 'Prospective Athlete' })

  console.log('Seed complete. Dev login password for every user:', PASSWORD)
  console.log('Coaches: mara@recbuddy.app, sam@recbuddy.app | Athletes: jordan@recbuddy.app, priya@recbuddy.app')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
