import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

/**
 * MINIMAL App Review demo seeder — prod-safe.
 *
 * Creates exactly ONE demo coach + ONE demo athlete, connected, with a plan,
 * workouts (past→today→future), a couple of logged actuals, and a chat thread.
 * The reviewer logs in as the ATHLETE (this is the athlete iOS app). The coach
 * exists only to populate the relationship + chat.
 *
 * Unlike seed.ts (which injects a whole fake roster), this touches only the two
 * REVIEW_* emails below, so it is safe to run against the PROD project without
 * cluttering it. Re-running deletes-then-recreates just those two accounts.
 *
 * Run against prod:  npm run seed:review   (uses .env.prod service-role key)
 *
 * .env.prod MUST point at the SAME project the iOS Release/"RecBuddy Prod" build
 * talks to (Config.prod.xcconfig → dclxyvtxwibtilnatyqp), NOT the dev/cloud
 * project in .env.cloud — otherwise the demo account won't exist for the
 * reviewer. The script prints its target host on start; confirm it before trusting a run.
 *
 * After it prints the credentials, paste them into
 * docs/appstore/listing.md → "Reviewer notes".
 */

const sql = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Dedicated review identities — deliberately NOT the seed.ts demo users, and
// unlikely to collide with a real signup. Override the password via env if you
// prefer not to hardcode it in the repo.
const REVIEW_COACH_EMAIL = 'review-coach@recbuddy.app'
const REVIEW_ATHLETE_EMAIL = 'review-athlete@recbuddy.app'
const PASSWORD = process.env.REVIEW_PASSWORD ?? 'RecBuddy-Review-2026!'

// ---- date helpers (UTC, matching the app's week.ts) ----
const ISO = (d: Date) => d.toISOString().slice(0, 10)
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x }
const mondayOf = (d: Date) => addDays(d, -(((d.getUTCDay() + 6) % 7)))
const TODAY = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
const TODAY_ISO = ISO(TODAY)
const CUR_MON = mondayOf(TODAY) // Monday of the current week — the app opens here

// The signup trigger creates every user as an athlete; a coach is PROMOTED via
// the service-role client (the only path to the coach role).
async function makeUser(
  email: string,
  app: { role: 'coach' | 'athlete'; title?: string },
  user: { name: string; experience_level?: string; primary_goal?: string },
) {
  const { data: list } = await sql.auth.admin.listUsers()
  const existing = list.users.find((u) => u.email === email)
  if (existing) await sql.auth.admin.deleteUser(existing.id) // idempotent for THIS email only

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

function statusFor(dateISO: string, type: string): string {
  if (type === 'rest') return 'rest'
  if (dateISO < TODAY_ISO) return 'done'
  if (dateISO === TODAY_ISO) return 'today'
  return 'planned'
}

async function buildWeeks(planId: string, athleteId: string, template: Day[], weekOffsets: number[]) {
  const rows = weekOffsets.flatMap((wk) => {
    const mon = addDays(CUR_MON, wk * 7)
    return template.map((s, i) => {
      const date = ISO(addDays(mon, i))
      return {
        plan_id: planId, athlete_id: athleteId, date,
        type: s.type, title: s.title, dist: s.dist ?? null, pace: s.pace ?? null,
        dur: s.dur ?? null, note: s.note ?? null, sets: s.sets ?? [],
        status: statusFor(date, s.type),
      }
    })
  })
  const { error } = await sql.from('workouts').insert(rows)
  if (error) throw error
}

async function addActual(athleteId: string, date: string, a: { dist: number; pace: string; time: string; hr: number; feel: number }) {
  const { data } = await sql.from('workouts').select('id').eq('athlete_id', athleteId).eq('date', date).maybeSingle()
  if (data) await sql.from('workout_actuals').insert({ workout_id: data.id, athlete_id: athleteId, ...a, source: 'garmin' })
}

async function main() {
  const host = (() => { try { return new URL(process.env.SUPABASE_URL!).host } catch { return '(unset)' } })()
  console.log(`Seeding review demo into: ${host}`)

  // Safety belt: the reviewer's build talks to the prod project, so the demo
  // account has to land there. Refuse to run against anything else unless the
  // caller explicitly opts out (e.g. to stage the demo in dev first).
  const PROD_REF = 'dclxyvtxwibtilnatyqp' // Config.prod.xcconfig project ref
  if (!host.startsWith(PROD_REF) && process.env.ALLOW_ANY_TARGET !== '1') {
    console.error(
      `\n✋ Refusing to seed: ${host} is not the prod project (${PROD_REF}).` +
      `\n   The App Store build connects to prod, so the demo account must live there.` +
      `\n   Point .env.prod at the prod project, or set ALLOW_ANY_TARGET=1 to override.`,
    )
    process.exit(1)
  }

  // ---- the two demo identities ----
  const coach = await makeUser(REVIEW_COACH_EMAIL, { role: 'coach', title: 'Head Coach' }, { name: 'Coach Taylor' })
  const athlete = await makeUser(REVIEW_ATHLETE_EMAIL, { role: 'athlete' }, { name: 'Alex Rivera', experience_level: 'returning', primary_goal: 'pr' })

  // ---- connect them ----
  {
    const { error } = await sql.from('coach_athlete').insert({ coach_id: coach, athlete_id: athlete, relationship: 'head' })
    if (error) throw error
  }

  // ---- plan (goal date kept in the future relative to whenever this runs) ----
  const goalDate = ISO(addDays(TODAY, 42))
  const planId = (await sql.from('plans').insert({
    athlete_id: athlete,
    goal_race: 'Riverside Half Marathon', goal_date: goalDate, goal_distance: '13.1 mi',
    goal_time: '1:48:00', goal_pace: '8:14/mi', plan_week: 5, plan_weeks: 12, status: 'On track',
  }).select().single()).data!.id as string

  // ---- one realistic week (Mon..Sun) ----
  const week: Day[] = [
    { type: 'easy', title: 'Easy Run', dist: 4.5, pace: '9:40/mi', note: 'Loosen up for the week. Keep HR under 145.' },
    { type: 'speed', title: '5 × 800m', dist: 6.0, pace: '7:30/mi', note: 'Settle into 800 rhythm — recoveries matter as much as the reps.', sets: [['Warm-up', '1.5 mi easy + 4 strides'], ['5 × 800m', '@ 3:45 each, 400m jog recovery'], ['Cool-down', '1.0 mi easy']] },
    { type: 'easy', title: 'Easy Run', dist: 5.0, pace: '9:45/mi', note: 'Recovery from intervals. Flat route, easy effort.' },
    { type: 'tempo', title: 'Tempo 4 mi', dist: 6.0, pace: '8:20/mi', note: 'Hold form when it gets uncomfortable.', sets: [['Warm-up', '1 mi easy'], ['Tempo', '4 mi @ 8:20/mi'], ['Cool-down', '1 mi easy']] },
    { type: 'rest', title: 'Rest Day' },
    { type: 'long', title: 'Long Run 11 mi', dist: 11.0, pace: '9:25/mi', note: 'Longest run of the block. Fuel every 4 miles.', sets: [['Steady', '8 mi @ 9:30/mi'], ['Finish', '3 mi @ goal pace 8:14/mi']] },
    { type: 'cross', title: 'Cross-Train 45 min', dur: 45, note: 'Bike or swim, easy aerobic. Active recovery.' },
  ]

  // Past week (history), current week (opens here), next week (upcoming).
  await buildWeeks(planId, athlete, week, [-1, 0, 1])

  // ---- a couple of logged runs so the "log" experience is visible ----
  await addActual(athlete, ISO(addDays(CUR_MON, -7)), { dist: 4.6, pace: '9:36/mi', time: '44:09', hr: 141, feel: 4 }) // last Mon easy
  await addActual(athlete, ISO(addDays(CUR_MON, -2)), { dist: 10.8, pace: '9:28/mi', time: '1:42:18', hr: 149, feel: 3 }) // last Sat long

  // ---- chat thread: text + runcard + adjust + a shared scheduled workout ----
  const threadId = (await sql.from('message_threads').insert({ athlete_id: athlete, coach_id: coach }).select().single()).data!.id as string
  await sql.from('messages').insert([
    { thread_id: threadId, from_user_id: coach, kind: 'text', body: 'Big long run this weekend — 11 miles, last 3 at goal pace. Fuel around mile 5.', read: true },
    { thread_id: threadId, from_user_id: athlete, kind: 'runcard', payload: { title: 'Long Run 11 mi', dist: '10.8 mi', pace: '9:28/mi', time: '1:42:18', hr: 149 }, read: true },
    { thread_id: threadId, from_user_id: coach, kind: 'adjust', payload: { from: '6 × 400m', to: '5 × 800m @ 3:45', reason: 'Stronger threshold stimulus' }, read: true },
  ])
  // Hybrid card: snapshot + link to the live workout row (this Saturday's long run).
  const long = (await sql.from('workouts').select('id, date, type, title, dist, pace').eq('athlete_id', athlete).eq('date', ISO(addDays(CUR_MON, 5))).maybeSingle()).data
  if (long) await sql.from('messages').insert({ thread_id: threadId, from_user_id: coach, kind: 'workout', workout_id: long.id, payload: { date: long.date, type: long.type, title: long.title, dist: long.dist, pace: long.pace }, read: true })

  console.log('\n✅ Review demo seeded.')
  console.log('   Paste these into docs/appstore/listing.md → Reviewer notes:')
  console.log(`   Login (athlete): ${REVIEW_ATHLETE_EMAIL}`)
  console.log(`   Password:        ${PASSWORD}`)
  console.log(`   Current week starts ${ISO(CUR_MON)} — the calendar opens here with live data.`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
