import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Shared demo-athlete builder behind two seeders:
 *   - seed-screenshots.ts (dev)  — App Store screenshots
 *   - seed-review.ts      (prod) — the account App Review signs in with
 * One builder keeps the reviewer's account showing what the screenshots show.
 *
 * Builds one athlete mid-way through a 14-week half-marathon block with a
 * two-coach team: 9 weeks of completed history with logged results, the current
 * week half done (today's long run still to do), upcoming weeks through race
 * day, and a coach chat (run card, adjustment, shared workout, texts).
 *
 * Touches ONLY the identities passed in (delete-then-recreate by email), so it
 * is safe beside real users. Dates use the machine's LOCAL timezone and are
 * relative to the run date — run it on the day the data is needed.
 */

export type Person = { email: string; name: string }

export type DemoConfig = {
  head: Person        // 'Head Coach' — owns the chat thread
  assistant: Person   // 'Strength Coach'
  athlete: Person
  password: string    // shared by all three identities
  /** Optional unconsumed invite from the head coach (lets someone test code sign-up). */
  invite?: { code: string; athleteName: string }
}

export type DemoResult = {
  start: string; raceDay: string; curWeek: number; blockWeeks: number
  workouts: number; actuals: number; messages: number
}

// ---- LOCAL date helpers (the Simulator/device uses local time) ----
const pad = (n: number) => String(n).padStart(2, '0')
const ISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const mondayOf = (d: Date) => addDays(d, -((d.getDay() + 6) % 7))
const at = (d: Date, h: number, m: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).toISOString()

// ---- pace/time math (canonical 'M:SS/mi', elapsed 'H:MM:SS' | 'MM:SS') ----
const paceSec = (p: string) => { const [m, s] = p.replace('/mi', '').split(':').map(Number); return m * 60 + s }
const fmtPace = (sec: number) => { const r = Math.round(sec); return `${Math.floor(r / 60)}:${pad(r % 60)}/mi` }
const fmtTime = (sec: number) => {
  const r = Math.round(sec), h = Math.floor(r / 3600), m = Math.floor((r % 3600) / 60), s = r % 60
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

type Day = {
  type: string; title: string; dist?: number; pace?: string; dur?: number
  note?: string; sets?: [string, string][]
}

// ---- the block: 14 weeks, current week = week 10 ----
const BLOCK_WEEKS = 14
const CUR_WEEK = 10
const GOAL_PACE = '8:01/mi'
const LONG = [7, 8, 9, 7, 10, 10, 11, 8, 11, 12, 12, 13, 9, 0]
const SPEED: [string, string, number, string][] = [
  ['6 × 400m', '@ 1:48 each, 200m jog', 5, '8:10/mi'],
  ['6 × 800m', '@ 3:40 each, 400m jog', 6, '7:45/mi'],
  ['8 × 400m', '@ 1:46 each, 200m jog', 5.5, '8:05/mi'],
  ['Hill Repeats', '8 × 60s hard uphill, jog down', 5, '8:30/mi'],
  ['5 × 1K', '@ 4:52 each, 2:00 jog', 6.5, '7:40/mi'],
  ['6 × 800m', '@ 3:38 each, 400m jog', 6, '7:45/mi'],
  ['3 × 1 mi', '@ 7:50 each, 3:00 jog', 6, '7:50/mi'],
  ['8 × 400m', '@ 1:44 each, 200m jog', 5.5, '8:05/mi'],
  ['6 × 800m', '@ 3:36 each, 400m jog', 6.5, '7:40/mi'],
  ['5 × 1K', '@ 4:50 each, 2:00 jog', 6.5, '7:40/mi'],
  ['4 × 1 mi', '@ 7:45 each, 3:00 jog', 7, '7:50/mi'],
  ['6 × 800m', '@ 3:34 each, 400m jog', 6.5, '7:40/mi'],
  ['4 × 800m', '@ 3:36 each, 400m jog', 5, '8:00/mi'],
  ['Race Openers', '4 × 200m relaxed-fast', 3, '9:00/mi'],
]

function weekPlan(wk: number): Day[] {
  const [speedTitle, speedDetail, speedDist, speedPace] = SPEED[wk - 1]
  const long = LONG[wk - 1]
  const tempoMi = wk <= 3 ? 3 : wk <= 9 ? 4 : wk <= 12 ? 5 : 3
  const easy = wk >= 13 ? 4 : wk >= 5 ? 5 : 4
  const taper = wk >= 13
  const days: Day[] = [
    { type: 'easy', title: 'Easy Run', dist: easy, pace: '9:15/mi', note: 'Conversational effort. Keep HR under 150.' },
    {
      type: 'speed', title: speedTitle, dist: speedDist, pace: speedPace,
      note: 'Quality day — smooth and fast, not all-out. The recoveries are part of the workout.',
      sets: [['Warm-up', '1.5 mi easy + drills'], [speedTitle, speedDetail], ['Cool-down', '1 mi easy']],
    },
    { type: 'easy', title: 'Easy Run', dist: easy, pace: '9:20/mi', note: 'Flat route, easy legs.' },
    {
      type: 'tempo', title: `Tempo ${tempoMi} mi`, dist: tempoMi + 2, pace: '8:05/mi',
      note: 'Comfortably hard. Settle in by mile 2 and hold form when it bites.',
      sets: [['Warm-up', '1 mi easy + 4 strides'], ['Tempo', `${tempoMi} mi @ 8:05/mi`], ['Cool-down', '1 mi easy']],
    },
    { type: 'rest', title: 'Rest Day' },
  ]
  if (wk === BLOCK_WEEKS) {
    days.push({ type: 'recovery', title: 'Shakeout 2 mi', dist: 2, pace: '9:45/mi', note: 'Loosen up. Lay out your race kit tonight.' })
    days.push({ type: 'race', title: 'Harbor City Half', dist: 13.1, pace: GOAL_PACE, note: 'Race day. Start controlled, trust the training, empty the tank from mile 10.' })
    return days
  }
  const goalMi = long >= 11 ? 4 : long >= 9 ? 3 : 0
  days.push({
    type: 'long', title: `Long Run ${long} mi`, dist: long, pace: '8:55/mi',
    note: goalMi
      ? `Keep the first ${long - goalMi} relaxed, then finish the last ${goalMi} at goal pace (${GOAL_PACE}). Gel at miles 4 and 8.`
      : 'Steady aerobic effort. Practice your race-morning breakfast.',
    sets: goalMi
      ? [['Warm-up', '1 mi easy'], ['Steady', `${long - 1 - goalMi} mi @ 8:55/mi`], ['Goal pace', `${goalMi} mi @ ${GOAL_PACE}`]]
      : [],
  })
  days.push(wk % 2 === 0 || taper
    ? { type: 'recovery', title: 'Recovery Run 4 mi', dist: 4, pace: '9:50/mi', note: 'Truly easy. Shake out yesterday.' }
    : { type: 'cross', title: 'Cross-Train 45 min', dur: 45, note: 'Bike or swim, easy aerobic effort.' })
  return days
}

const HR: Record<string, [number, number]> = {
  easy: [138, 147], recovery: [131, 138], long: [145, 153], tempo: [159, 166], speed: [163, 171], race: [168, 174],
}

const ATHLETE_NOTES: Record<string, string> = {
  // keyed by "<weekNumber>-<dayIndex>"
  '10-1': 'Reps 2–5 all under 4:50. Windy on the back stretch but felt strong.',
  '10-3': 'Controlled through mile 4. Last mile was a grind but held pace.',
  '9-5': 'Negative split! Fueling at 4 and 8 worked perfectly.',
  '8-3': 'Legs heavy from the week but got it done.',
}

export async function seedDemoAthlete(sql: SupabaseClient, cfg: DemoConfig): Promise<DemoResult> {
  const TODAY = (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()) })()
  const TODAY_ISO = ISO(TODAY)
  const CUR_MON = mondayOf(TODAY)
  const START = addDays(CUR_MON, -(CUR_WEEK - 1) * 7)
  const RACE_DAY = addDays(START, BLOCK_WEEKS * 7 - 1) // Sunday of week 14

  // Deterministic jitter so re-runs produce the same data.
  let seed = 20260912
  const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 }
  const between = (lo: number, hi: number) => lo + rand() * (hi - lo)

  const makeUser = async (p: Person, meta: Record<string, string> = {}) => {
    const { data: list, error: lErr } = await sql.auth.admin.listUsers({ perPage: 1000 })
    if (lErr) throw lErr
    const existing = list.users.find((u) => u.email === p.email)
    if (existing) await sql.auth.admin.deleteUser(existing.id) // cascades their plan/workouts/chat/invites
    const { data, error } = await sql.auth.admin.createUser({
      email: p.email, password: cfg.password, email_confirm: true, user_metadata: { name: p.name, ...meta },
    })
    if (error) throw error
    return data.user!.id
  }

  // The signup trigger creates every user as an athlete; the service role is
  // the only path to the coach role.
  const promoteCoach = async (id: string, title: string) => {
    const { error } = await sql.from('profiles')
      .update({ role: 'coach', is_coach: true, is_athlete: false, title }).eq('id', id)
    if (error) throw error
  }

  // ---- identities ----
  const head = await makeUser(cfg.head)
  await promoteCoach(head, 'Head Coach')
  const assistant = await makeUser(cfg.assistant)
  await promoteCoach(assistant, 'Strength Coach')
  const athlete = await makeUser(cfg.athlete, { experience_level: 'experienced', primary_goal: 'pr' })

  {
    const { error } = await sql.from('coach_athlete').insert([
      { coach_id: head, athlete_id: athlete, relationship: 'head', permission: 'admin' },
      { coach_id: assistant, athlete_id: athlete, relationship: 'assistant', permission: 'edit' },
    ])
    if (error) throw error
  }

  // ---- plan ----
  const { data: planRow, error: planErr } = await sql.from('plans').insert({
    athlete_id: athlete, goal_race: 'Harbor City Half Marathon', goal_distance: '13.1 mi',
    goal_date: ISO(RACE_DAY), start_date: ISO(START), goal_time: '1:45:00', goal_pace: GOAL_PACE,
    plan_week: CUR_WEEK, plan_weeks: BLOCK_WEEKS, status: 'Crushing it',
  }).select().single()
  if (planErr) throw planErr
  const planId = planRow.id as string

  // ---- workouts: every week of the block ----
  const missed = new Set(['6-2']) // one skipped easy run, weeks ago — realism
  const rows: Record<string, unknown>[] = []
  const meta: { key: string; date: Date; day: Day }[] = []
  for (let wk = 1; wk <= BLOCK_WEEKS; wk++) {
    const mon = addDays(START, (wk - 1) * 7)
    weekPlan(wk).forEach((day, i) => {
      const date = addDays(mon, i)
      const iso = ISO(date)
      const key = `${wk}-${i}`
      const status = day.type === 'rest' ? 'rest'
        : missed.has(key) ? 'missed'
        : iso < TODAY_ISO ? 'done'
        : iso === TODAY_ISO ? 'today' : 'planned'
      rows.push({
        plan_id: planId, athlete_id: athlete, date: iso, type: day.type, title: day.title,
        dist: day.dist ?? null, pace: day.pace ?? null, dur: day.dur ?? null,
        note: day.note ?? null, sets: day.sets ?? [], status,
      })
      meta.push({ key, date, day })
    })
  }
  // Today's second item: post-run mobility (shows a multi-activity day).
  const todayMeta = meta.find((m) => ISO(m.date) === TODAY_ISO)
  const assistantFirst = cfg.assistant.name.split(' ')[0]
  rows.push({
    plan_id: planId, athlete_id: athlete, date: TODAY_ISO, type: 'cross', title: 'Mobility Flow', dur: 15,
    note: `Hips, calves, and glutes — 15 minutes after today’s run. ${assistantFirst}’s routine.`,
    sets: [['Hip openers', '2 rounds · 60s each side'], ['Calf raises', '3 × 15, slow lowering'], ['Glute bridges', '3 × 12']],
    status: 'today',
  })
  const { data: inserted, error: wErr } = await sql.from('workouts').insert(rows).select('id, date, type, title, dist, pace, status')
  if (wErr) throw wErr
  const idFor = (date: Date, type: string) => inserted!.find((w) => w.date === ISO(date) && w.type === type)!

  // ---- logged results for every completed session ----
  const actuals: Record<string, unknown>[] = []
  for (const m of meta) {
    const w = idFor(m.date, m.day.type)
    if (w.status !== 'done') continue
    const hour = m.day.type === 'long' ? 7 : 6
    const recorded_at = at(m.date, hour, Math.floor(between(5, 40)))
    if (m.day.type === 'cross') {
      const mins = (m.day.dur ?? 45) + between(-1, 3)
      const dist = +(mins / 60 * between(15.5, 17)).toFixed(1)
      actuals.push({
        workout_id: w.id, athlete_id: athlete, dist, pace: null, time: fmtTime(mins * 60),
        hr: Math.round(between(128, 138)), feel: 4, source: 'manual', activity: 'ride',
        avg_watts: Math.round(between(150, 172)), recorded_at,
      })
      continue
    }
    const planned = m.day.dist!
    const dist = +(planned + between(-0.05, 0.15)).toFixed(1)
    const pace = paceSec(m.day.pace!) - between(0, 9) // runs a touch quick
    const [lo, hi] = HR[m.day.type] ?? [140, 150]
    actuals.push({
      workout_id: w.id, athlete_id: athlete, dist, pace: fmtPace(pace), time: fmtTime(dist * pace),
      hr: Math.round(between(lo, hi)), feel: Math.round(between(3.4, 5)), source: 'manual', activity: 'run',
      note: ATHLETE_NOTES[m.key] ?? null, recorded_at,
    })
  }
  {
    const { error } = await sql.from('workout_actuals').insert(actuals)
    if (error) throw error
  }

  // ---- chat: one thread (head coach), both coaches post ----
  const { data: thread, error: tErr } = await sql.from('message_threads')
    .insert({ athlete_id: athlete, coach_id: head }).select().single()
  if (tErr) throw tErr

  const tue = addDays(CUR_MON, 1), thu = addDays(CUR_MON, 3), fri = addDays(CUR_MON, 4)
  const tempo = idFor(thu, 'tempo')
  const { data: tempoActual } = await sql.from('workout_actuals').select('dist, pace, time, hr').eq('workout_id', tempo.id).maybeSingle()
  // Today's main session (whatever weekday the seed runs on); none on a rest day.
  const todays = todayMeta ? inserted!.find((w) => w.date === TODAY_ISO && !['cross', 'rest'].includes(w.type)) : null

  // Timeline anchored to this week; anything that would land in the future
  // (seeding early in the week) is skipped rather than shown ahead of "now".
  const now = Date.now()
  const msgs: Record<string, unknown>[] = [
    { from_user_id: head, kind: 'text', created_at: at(tue, 19, 12),
      body: 'Nice work on the 1Ks today — that’s the most consistent set you’ve run all block.' },
    { from_user_id: athlete, kind: 'text', created_at: at(tue, 19, 30),
      body: 'Thank you!! Last rep felt like flying 🚀' },
    ...(tempoActual ? [{ from_user_id: athlete, kind: 'runcard', workout_id: tempo.id, created_at: at(thu, 18, 48),
      payload: { date: ISO(thu), type: 'tempo', title: tempo.title, dist: `${tempoActual.dist} mi`,
        pace: tempoActual.pace, time: tempoActual.time, hr: tempoActual.hr, note: ATHLETE_NOTES['10-3'] } }] : []),
    { from_user_id: head, kind: 'text', created_at: at(thu, 19, 2),
      body: 'Huge. Sub-8:05 with HR in the low 160s is exactly where we want you 5 weeks out 👏' },
    { from_user_id: head, kind: 'adjust', created_at: at(thu, 19, 3),
      payload: { from: '6 × 800m', to: '4 × 1 mi @ 7:45', reason: 'You’re ready for longer threshold reps next Tuesday.' } },
    { from_user_id: athlete, kind: 'text', created_at: at(thu, 19, 15),
      body: 'Let’s go! Should I still do strides tomorrow?' },
    { from_user_id: assistant, kind: 'text', created_at: at(fri, 8, 5),
      body: 'Skip the strides — rest day is rest. Do the 15-min mobility flow after your next run instead.' },
    { from_user_id: athlete, kind: 'text', created_at: at(fri, 8, 21), body: 'Copy that 🙏' },
  ]
  if (todays) {
    msgs.push(
      { from_user_id: head, kind: 'workout', workout_id: todays.id, created_at: at(TODAY, 6, 32),
        payload: { date: todays.date, type: todays.type, title: todays.title, dist: todays.dist == null ? null : Number(todays.dist), pace: todays.pace } },
      { from_user_id: head, kind: 'text', created_at: at(TODAY, 6, 33),
        body: 'Today’s session is up. Stay relaxed early and finish strong — you’ve earned this one.' },
      { from_user_id: athlete, kind: 'text', created_at: at(TODAY, 6, 41), body: 'Fueled up and heading out ☀️' },
    )
  }
  const timeline = msgs.filter((m) => Date.parse(m.created_at as string) <= now)
  {
    const { error } = await sql.from('messages').insert(timeline.map((m) => ({ thread_id: thread.id, read: true, ...m })))
    if (error) throw error
  }

  // ---- optional invite (code sign-up path) ----
  if (cfg.invite) {
    const { error } = await sql.from('invites').insert({
      code: cfg.invite.code, coach_id: head, athlete_name: cfg.invite.athleteName,
      goal_race: 'Harbor City Half Marathon', goal_distance: '13.1 mi',
      goal_date: ISO(RACE_DAY), goal_time: '1:45:00', goal_start_date: ISO(START),
    })
    if (error) throw error
  }

  return {
    start: ISO(START), raceDay: ISO(RACE_DAY), curWeek: CUR_WEEK, blockWeeks: BLOCK_WEEKS,
    workouts: rows.length, actuals: actuals.length, messages: timeline.length,
  }
}
