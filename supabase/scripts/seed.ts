import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const sql = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = 'recbuddy-dev' // documented dev password for every seeded user

// ---- date helpers (UTC, matching the app's week.ts) ----
const ISO = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x }
const mondayOf = (d: Date) => addDays(d, -(((d.getUTCDay() + 6) % 7)))
const TODAY = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
const TODAY_ISO = ISO(TODAY)
const CUR_MON = mondayOf(TODAY) // Monday of the current week — the app opens here

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
    email, password: PASSWORD, email_confirm: true, user_metadata: user,
  })
  if (error) throw error
  const id = data.user!.id
  if (app.role === 'coach') {
    const { error: pErr } = await sql.from('profiles').update({ role: 'coach', title: app.title ?? null }).eq('id', id)
    if (pErr) throw pErr
  }
  return id
}

type Day = { type: string; title: string; dist?: number | null; pace?: string | null; dur?: number | null; note?: string; sets?: [string, string][] }

// Status from the date: past = done (unless explicitly missed), today = today, future = planned; rest stays rest.
function statusFor(dateISO: string, type: string, missed: Set<string>): string {
  if (type === 'rest') return 'rest'
  if (missed.has(dateISO)) return 'missed'
  if (dateISO < TODAY_ISO) return 'done'
  if (dateISO === TODAY_ISO) return 'today'
  return 'planned'
}

// Build N weeks of workouts from a 7-day (Mon..Sun) template. weekOffsets like [-1,0,1].
async function buildWeeks(planId: string, athleteId: string, template: Day[], weekOffsets: number[], missed = new Set<string>()) {
  const rows = weekOffsets.flatMap((wk) => {
    const mon = addDays(CUR_MON, wk * 7)
    return template.map((s, i) => {
      const date = ISO(addDays(mon, i))
      return {
        plan_id: planId, athlete_id: athleteId, date,
        type: s.type, title: s.title, dist: s.dist ?? null, pace: s.pace ?? null,
        dur: s.dur ?? null, note: s.note ?? null, sets: s.sets ?? [],
        status: statusFor(date, s.type, missed),
      }
    })
  })
  const { error } = await sql.from('workouts').insert(rows)
  if (error) throw error
}

// Attach a synced "actual" to a given athlete+date workout (if it exists).
async function addActual(athleteId: string, date: string, a: { dist: number; pace: string; time: string; hr: number; feel: number }) {
  const { data } = await sql.from('workouts').select('id').eq('athlete_id', athleteId).eq('date', date).maybeSingle()
  if (data) await sql.from('workout_actuals').insert({ workout_id: data.id, athlete_id: athleteId, ...a, source: 'garmin' })
}

async function main() {
  // ---- coaches ----
  const mara = await makeUser('mara@recbuddy.app', { role: 'coach', title: 'Head Coach' }, { name: 'Mara Whitlock' })
  const sam = await makeUser('sam@recbuddy.app', { role: 'coach', title: 'Assistant Coach' }, { name: 'Sam Okafor' })

  // ---- athletes ----
  const jordan = await makeUser('jordan@recbuddy.app', { role: 'athlete' }, { name: 'Jordan Reyes', experience_level: 'returning', primary_goal: 'pr' })
  const priya = await makeUser('priya@recbuddy.app', { role: 'athlete' }, { name: 'Priya Nair', experience_level: 'new', primary_goal: 'first-race' })
  const marcus = await makeUser('marcus@recbuddy.app', { role: 'athlete' }, { name: 'Marcus Bell', experience_level: 'experienced', primary_goal: 'pr' })
  const sofia = await makeUser('sofia@recbuddy.app', { role: 'athlete' }, { name: 'Sofia Lindqvist', experience_level: 'new', primary_goal: 'first-race' })

  // ---- roster: Mara heads all four; Sam assists Jordan + Marcus ----
  await sql.from('coach_athlete').insert([
    { coach_id: mara, athlete_id: jordan, relationship: 'head' },
    { coach_id: mara, athlete_id: priya, relationship: 'head' },
    { coach_id: mara, athlete_id: marcus, relationship: 'head' },
    { coach_id: mara, athlete_id: sofia, relationship: 'head' },
    { coach_id: sam, athlete_id: jordan, relationship: 'assistant' },
    { coach_id: sam, athlete_id: marcus, relationship: 'assistant' },
  ])

  // ---- plans (one per athlete) ----
  const plan = async (athleteId: string, p: Record<string, unknown>) =>
    (await sql.from('plans').insert({ athlete_id: athleteId, ...p }).select().single()).data!.id as string

  const jordanPlan = await plan(jordan, { goal_race: 'Riverside Half Marathon', goal_date: '2026-08-23', goal_distance: '13.1 mi', goal_time: '1:48:00', goal_pace: '8:14/mi', plan_week: 5, plan_weeks: 16, status: 'On track' })
  const priyaPlan = await plan(priya, { goal_race: 'Lakeside 10K', goal_date: '2026-07-19', goal_distance: '6.2 mi', goal_time: '55:00', goal_pace: '8:50/mi', plan_week: 7, plan_weeks: 10, status: 'Crushing it' })
  const marcusPlan = await plan(marcus, { goal_race: 'Capital City Marathon', goal_date: '2026-10-11', goal_distance: '26.2 mi', goal_time: '3:25:00', goal_pace: '7:50/mi', plan_week: 9, plan_weeks: 18, status: 'Needs check-in' })
  const sofiaPlan = await plan(sofia, { goal_race: 'Parkside 5K', goal_date: '2026-07-05', goal_distance: '3.1 mi', goal_time: '30:00', goal_pace: '9:40/mi', plan_week: 3, plan_weeks: 8, status: 'On track' })

  // ---- weekly templates (Mon..Sun) ----
  const jordanWeek: Day[] = [
    { type: 'easy', title: 'Easy Run', dist: 4.5, pace: '9:40/mi', note: 'Loosen up for the week. Keep HR under 145.' },
    { type: 'speed', title: '5 × 800m', dist: 6.0, pace: '7:30/mi', note: 'Settle into 800 rhythm — recoveries matter as much as the reps.', sets: [['Warm-up', '1.5 mi easy + 4 strides'], ['5 × 800m', '@ 3:45 each, 400m jog recovery'], ['Cool-down', '1.0 mi easy']] },
    { type: 'easy', title: 'Easy Run', dist: 5.0, pace: '9:45/mi', note: 'Recovery from intervals. Flat route, easy effort.' },
    { type: 'tempo', title: 'Tempo 4 mi', dist: 6.0, pace: '8:20/mi', note: 'Hold form when it gets uncomfortable.', sets: [['Warm-up', '1 mi easy'], ['Tempo', '4 mi @ 8:20/mi'], ['Cool-down', '1 mi easy']] },
    { type: 'rest', title: 'Rest Day' },
    { type: 'long', title: 'Long Run 11 mi', dist: 11.0, pace: '9:25/mi', note: 'Longest run of the block. Fuel every 4 miles.', sets: [['Steady', '8 mi @ 9:30/mi'], ['Finish', '3 mi @ goal pace 8:14/mi']] },
    { type: 'cross', title: 'Cross-Train 45 min', dur: 45, note: 'Bike or swim, easy aerobic. Active recovery.' },
  ]
  const priyaWeek: Day[] = [
    { type: 'rest', title: 'Rest Day' },
    { type: 'easy', title: 'Easy Run', dist: 3.0, pace: '10:30/mi', note: 'Nice and relaxed.' },
    { type: 'speed', title: '6 × 400m', dist: 3.5, pace: '8:40/mi', note: 'First real speed session — focus on form, not heroics.', sets: [['Warm-up', '1 mi easy'], ['6 × 400m', '@ 5K effort, 200m walk'], ['Cool-down', '0.5 mi']] },
    { type: 'rest', title: 'Rest Day' },
    { type: 'easy', title: 'Easy Run', dist: 3.5, pace: '10:20/mi' },
    { type: 'long', title: 'Long Run 5 mi', dist: 5.0, pace: '10:45/mi', note: 'Time on feet. Walk breaks are fine.' },
    { type: 'cross', title: 'Yoga / Mobility', dur: 30, note: '30 min, focus on hips.' },
  ]
  const marcusWeek: Day[] = [
    { type: 'easy', title: 'Easy Run', dist: 6.0, pace: '8:50/mi' },
    { type: 'tempo', title: 'Tempo 6 mi', dist: 9.0, pace: '7:40/mi', note: 'Marathon-effort work. Bread and butter.', sets: [['Warm-up', '1.5 mi'], ['Tempo', '6 mi @ 7:40/mi'], ['Cool-down', '1.5 mi']] },
    { type: 'easy', title: 'Easy Run', dist: 6.0, pace: '8:50/mi' },
    { type: 'speed', title: '5 × 1km', dist: 8.0, pace: '7:05/mi', note: 'VO2 work. Strong but controlled.', sets: [['Warm-up', '2 mi easy'], ['5 × 1km', '@ 4:25, 2:30 jog'], ['Cool-down', '1.5 mi']] },
    { type: 'rest', title: 'Rest Day' },
    { type: 'long', title: 'Long Run 18 mi', dist: 18.0, pace: '8:40/mi', note: 'Last 6 at marathon pace. Practice fueling.', sets: [['Steady', '12 mi @ 8:50/mi'], ['MP', '6 mi @ 7:50/mi']] },
    { type: 'easy', title: 'Recovery Run', dist: 5.0, pace: '9:10/mi' },
  ]
  const sofiaWeek: Day[] = [
    { type: 'easy', title: 'Easy Run', dist: 2.5, pace: '11:00/mi', note: 'Keep it conversational.' },
    { type: 'speed', title: '8 × 200m', dist: 2.5, pace: '9:30/mi', note: 'Quick feet, full recovery.', sets: [['Warm-up', '1 mi'], ['8 × 200m', '@ fast, walk back'], ['Cool-down', '0.5 mi']] },
    { type: 'rest', title: 'Rest Day' },
    { type: 'easy', title: 'Easy Run', dist: 3.0, pace: '10:50/mi' },
    { type: 'rest', title: 'Rest Day' },
    { type: 'long', title: 'Long Run 4 mi', dist: 4.0, pace: '11:10/mi', note: 'Build the engine. Walk breaks welcome.' },
    { type: 'cross', title: 'Cross-Train 30 min', dur: 30, note: 'Easy bike or elliptical.' },
  ]

  // ---- workouts: a few weeks each so the grid opens populated + has history ----
  // Mark Jordan's previous-week Tuesday (speed) as a missed session for realism.
  const jordanMissed = new Set<string>([ISO(addDays(CUR_MON, -7 + 1))])
  await buildWeeks(jordanPlan, jordan, jordanWeek, [-1, 0, 1], jordanMissed)
  await buildWeeks(priyaPlan, priya, priyaWeek, [0, 1])
  await buildWeeks(marcusPlan, marcus, marcusWeek, [-1, 0, 1])
  await buildWeeks(sofiaPlan, sofia, sofiaWeek, [0])

  // ---- synced actuals on a couple of completed runs ----
  await addActual(jordan, ISO(addDays(CUR_MON, -7)), { dist: 4.6, pace: '9:36/mi', time: '44:09', hr: 141, feel: 4 })
  await addActual(marcus, ISO(addDays(CUR_MON, -7)), { dist: 6.1, pace: '8:47/mi', time: '53:36', hr: 138, feel: 4 })

  // ---- Mara's workout library (presets + one custom) ----
  await sql.from('library_workouts').insert([
    { coach_id: mara, type: 'easy', title: 'Easy Run', dist: 5, pace: '9:45/mi', note: 'Conversational pace — relaxed and honest.', sets: [], custom: false },
    { coach_id: mara, type: 'long', title: 'Long Run', dist: 10, pace: '9:30/mi', note: 'Steady aerobic effort. Fuel every 4 miles.', sets: [], custom: false },
    { coach_id: mara, type: 'speed', title: 'Intervals', dist: 6, pace: '7:30/mi', note: 'Quality session — respect the recoveries.', sets: [['Warm-up', '1.5 mi easy'], ['Reps', '6 × 800m @ 3:45'], ['Cool-down', '1 mi easy']], custom: false },
    { coach_id: mara, type: 'tempo', title: 'Tempo Run', dist: 6, pace: '8:20/mi', note: 'Comfortably hard — half-marathon engine work.', sets: [], custom: false },
    { coach_id: mara, type: 'recovery', title: 'Shakeout Jog', dist: 3, pace: '10:30/mi', note: 'Super easy. Flush the legs.', sets: [], custom: false },
    { coach_id: mara, type: 'speed', title: 'Hill Repeats (custom)', dist: 5, pace: '8:00/mi', note: 'Mara’s go-to strength session.', sets: [['Warm-up', '1.5 mi easy'], ['8 × 60s hills', 'hard up, jog down'], ['Cool-down', '1 mi easy']], custom: true },
  ])

  // ---- chat threads ----
  const thread = async (athleteId: string) => (await sql.from('message_threads').insert({ athlete_id: athleteId, coach_id: mara }).select().single()).data!.id as string
  const jt = await thread(jordan)
  await sql.from('messages').insert([
    { thread_id: jt, from_user_id: mara, kind: 'text', body: 'Big long run this weekend — 11 miles, last 3 at goal pace. Fuel around mile 5.', read: true },
    { thread_id: jt, from_user_id: jordan, kind: 'runcard', payload: { title: 'Long Run 9 mi', dist: '9.1 mi', pace: '9:22/mi', time: '1:25:14', hr: 152 }, read: true },
    { thread_id: jt, from_user_id: mara, kind: 'adjust', payload: { from: '6 × 400m', to: '5 × 800m @ 3:45', reason: 'Stronger threshold stimulus' }, read: true },
  ])
  // A shared scheduled workout (hybrid card: snapshot + link to the live row).
  const jLong = (await sql.from('workouts').select('id, date, type, title, dist, pace').eq('athlete_id', jordan).eq('date', ISO(addDays(CUR_MON, 5))).maybeSingle()).data
  if (jLong) await sql.from('messages').insert({ thread_id: jt, from_user_id: mara, kind: 'workout', workout_id: jLong.id, payload: { date: jLong.date, type: jLong.type, title: jLong.title, dist: jLong.dist, pace: jLong.pace }, read: true })
  const pt = await thread(priya)
  await sql.from('messages').insert([
    { thread_id: pt, from_user_id: mara, kind: 'text', body: 'Great first speed session! How did the 400s feel?', read: true },
    { thread_id: pt, from_user_id: priya, kind: 'text', body: 'Tough but fun 😅 legs felt strong by the last few.', read: false },
  ])

  // ---- pending invites for the roster "Add athlete" demo ----
  await sql.from('invites').insert([
    { code: 'WELCOMERUN', coach_id: mara, athlete_name: 'Dana Okoro' },
    { code: 'TRAILGOAT2', coach_id: mara, athlete_name: 'Eli Tan' },
  ])

  console.log('Seed complete. Dev login password for every user:', PASSWORD)
  console.log('Coaches:  mara@recbuddy.app (head), sam@recbuddy.app (assistant)')
  console.log('Athletes: jordan, priya, marcus, sofia @recbuddy.app')
  console.log('Current week starts', ISO(CUR_MON), '— the dashboard opens here with live data.')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
