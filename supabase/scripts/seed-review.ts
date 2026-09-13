import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import { seedDemoAthlete } from './lib/demo-athlete'

/**
 * App Review demo seeder — prod-safe.
 *
 * Creates the account App Review signs in with: a demo athlete with a two-coach
 * team, a 14-week plan with history, logged runs, and a coach chat — the same
 * builder as the screenshots (lib/demo-athlete.ts), so the reviewer sees what
 * the listing shows. Also creates an unconsumed coach invite (INVITE_CODE) so
 * the reviewer can try code sign-up. Touches only the three emails below
 * (delete-then-recreate), so it is safe to run against PROD.
 *
 * Dates are relative to the run date: run it on submission day, and again before
 * any resubmission (a reviewer may also have deleted the account).
 *
 * Run against prod:  npm run seed:review   (uses .env.prod; REVIEW_PASSWORD required)
 *
 * .env.prod MUST point at the SAME project the iOS Release/"RecBuddy Prod" build
 * talks to (Config.prod.xcconfig → dclxyvtxwibtilnatyqp) — otherwise the demo
 * account won't exist for the reviewer. The script prints its target host on
 * start; confirm it before trusting a run.
 *
 * The password goes ONLY into App Store Connect → App Review Information. This
 * repo is public: never commit it (not in listing.md, not in this file).
 */

const PROD_REF = 'dclxyvtxwibtilnatyqp' // Config.prod.xcconfig project ref
const ATHLETE_EMAIL = 'review-athlete@recbuddy.app'
const INVITE_CODE = 'APPREVIEW'

const sql = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  const host = (() => { try { return new URL(process.env.SUPABASE_URL!).host } catch { return '(unset)' } })()
  console.log(`Seeding review demo into: ${host}`)

  // Safety belt: the reviewer's build talks to the prod project, so the demo
  // account has to land there. Refuse to run against anything else unless the
  // caller explicitly opts out (e.g. to stage the demo in dev first).
  if (!host.startsWith(PROD_REF) && process.env.ALLOW_ANY_TARGET !== '1') {
    console.error(
      `\n✋ Refusing to seed: ${host} is not the prod project (${PROD_REF}).` +
      `\n   The App Store build connects to prod, so the demo account must live there.` +
      `\n   Point .env.prod at the prod project, or set ALLOW_ANY_TARGET=1 to override.`,
    )
    process.exit(1)
  }

  // No default: a password in this public repo is a password anyone can use.
  const password = process.env.REVIEW_PASSWORD ?? ''
  if (password.length < 12) {
    console.error('\n✋ Set REVIEW_PASSWORD (12+ characters) in .env.prod or the environment.')
    process.exit(1)
  }

  const r = await seedDemoAthlete(sql, {
    head: { email: 'review-coach@recbuddy.app', name: 'Dani Brooks' },
    assistant: { email: 'review-assistant@recbuddy.app', name: 'Marcus Hale' },
    athlete: { email: ATHLETE_EMAIL, name: 'Maya Chen' },
    password,
    invite: { code: INVITE_CODE, athleteName: 'App Reviewer' },
  })

  console.log('\n✅ Review demo seeded.')
  console.log('   App Store Connect → App Review Information → Sign-in required:')
  console.log(`   User name: ${ATHLETE_EMAIL}`)
  console.log('   Password:  the REVIEW_PASSWORD this run used (not printed)')
  console.log(`   Coach invite code for sign-up testing: ${INVITE_CODE}`)
  console.log(`   Block: ${r.start} → race ${r.raceDay} (week ${r.curWeek} of ${r.blockWeeks})`)
  console.log(`   Workouts: ${r.workouts}, logged results: ${r.actuals}, messages: ${r.messages}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
