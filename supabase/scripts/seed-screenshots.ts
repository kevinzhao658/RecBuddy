import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { seedDemoAthlete } from './lib/demo-athlete'

/**
 * App Store SCREENSHOT seeder — DEV ONLY.
 *
 * The demo athlete (Maya Chen), her two-coach team, plan, logged runs, and chat
 * come from lib/demo-athlete.ts — shared with seed-review.ts so the App Review
 * account shows what the screenshots show. Touches only the three emails below.
 *
 * The chat timeline assumes captures late in the seeded week — run it the day
 * you shoot.
 *
 * Run:  npm run seed:screenshots   (uses .env.cloud → dev project)
 * Then sign in on the Simulator as ATHLETE_EMAIL.
 */

const DEV_REF = 'bawezljwxehadmkjeydw' // Config.dev.xcconfig project ref
const ATHLETE_EMAIL = 'maya.chen@recbuddy.app' // visible on the Settings screenshot

const sql = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const host = (() => { try { return new URL(process.env.SUPABASE_URL!).host } catch { return '(unset)' } })()
  console.log(`Seeding screenshot demo into: ${host}`)
  if (!host.startsWith(DEV_REF)) {
    console.error(`\n✋ Refusing to seed: ${host} is not the dev project (${DEV_REF}). Use .env.cloud.`)
    process.exit(1)
  }

  const password = process.env.SHOTS_PASSWORD ?? 'recbuddy-shots' // dev-only account
  const r = await seedDemoAthlete(sql, {
    head: { email: 'shots-coach-dani@recbuddy.app', name: 'Dani Brooks' },
    assistant: { email: 'shots-coach-marcus@recbuddy.app', name: 'Marcus Hale' },
    athlete: { email: ATHLETE_EMAIL, name: 'Maya Chen' },
    password,
  })

  console.log('\n✅ Screenshot demo seeded.')
  console.log(`   Athlete login: ${ATHLETE_EMAIL} / ${password}`)
  console.log(`   Block: ${r.start} → race ${r.raceDay} (week ${r.curWeek} of ${r.blockWeeks})`)
  console.log(`   Workouts: ${r.workouts}, logged results: ${r.actuals}, messages: ${r.messages}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
