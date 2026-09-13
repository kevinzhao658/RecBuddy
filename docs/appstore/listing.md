# RecBuddy — App Store Listing Copy (v1.0)

Draft copy for App Store Connect. Character limits noted; counts are approximate —
verify in App Store Connect, which enforces them. Bracketed `[…]` items are
placeholders to fill before submitting.

---

## App name (max 30)
`RecBuddy`  *(8)*

> Must be globally unique on the App Store. If "RecBuddy" is taken, fall back to a
> qualified name, e.g. `RecBuddy: Run Coaching` *(23)* or `RecBuddy Running` *(16)*.

## Subtitle (max 30)
`Your coach, in your pocket`  *(26)*

Alternatives:
- `Run training with your coach`  *(28)*
- `Coached running plans`  *(21)*

## Promotional text (max 170) — editable anytime without a new build
`Train with a real coach, not a template. Get a running plan built for your
goal, log every run, and message your coach when the plan needs to flex.`  *(~150)*

## Keywords (max 100 chars, comma-separated, NO spaces)
`running,run coach,training plan,marathon,5k,10k,half marathon,run tracker,pace,workout log,coaching,runner`

> Notes: don't repeat words already in the app name/subtitle (they're indexed
> anyway), skip spaces to save characters, and use singular forms — the App Store
> matches plurals automatically. ~99 chars as written; trim a trailing term if
> App Store Connect flags the count.

## Description (max 4000)
```
RecBuddy connects you with a running coach for a plan that's actually yours —
not a one-size-fits-all template.

Your coach builds a training plan around your goal, whether that's your first
5K, a marathon PR, or just running more consistently. Every workout shows up on
your calendar with the distance, pace, and detail you need. Log how the run
actually went, and your coach sees it — so the plan adapts to real life instead
of ignoring it.

WHY RECBUDDY

• A plan built by your coach, for your goal — not an algorithm's guess
• See every workout on a clean weekly calendar
• Log your runs: distance, pace, time, heart rate, and how it felt
• Sync with Apple Health — completed runs and rides log themselves automatically
• Message your coach in-app and get workouts adjusted when you need it
• Keep your plan even between coaches — your training is yours to keep

HOW IT WORKS

1. Create your athlete account and set your goal.
2. Connect with your coach using an invite code.
3. Follow your personalized plan, log your runs, and stay in sync with your
   coach through chat.

MADE FOR RUNNERS AND THEIR COACHES

RecBuddy is a two-sided tool. Athletes get structure and accountability; coaches
get a clear window into how training is really going. No ads. No tracking. Just
you, your coach, and the work.

Questions or feedback? Reach us at support@recbuddy.app.
```

## What's New (version 1.0)
```
Welcome to RecBuddy! This first release includes personalized training plans
from your coach, a weekly workout calendar, run logging with pace and heart
rate, and in-app coach messaging. Thanks for running with us.
```

---

## App Store Connect metadata checklist

| Field | Value |
|---|---|
| Primary category | Health & Fitness |
| Secondary category (optional) | Sports |
| Age rating | Complete questionnaire → expected **4+** (no objectionable content) |
| Price | Free *(confirm)* |
| Privacy Policy URL | `https://recbuddy.app/privacy` *(host `privacy-policy.md`)* |
| Support URL | `https://recbuddy.app/support` *(or a contact page)* |
| Marketing URL (optional) | `https://recbuddy.app` |
| Copyright | `2026 Kevin Zhao` *(change if you file under a business entity)* |
| Contact email (App Review) | `kevinzhao658@gmail.com` *(private to Apple; support@recbuddy.app is the public one)* |

## Screenshots to capture (iPhone only; capture on a 6.9" device/simulator)
Suggested set, in order:
1. Weekly calendar with a plan populated
2. A workout detail card (distance / pace / sets)
3. Logging a run (actuals: pace, time, heart rate, feel)
4. Coach chat thread with a workout/adjust card
5. Goal/plan overview

> Required size: 6.9" iPhone. A 6.5" set is optional now but nice to include.
> No iPad screenshots needed — the app is iPhone-only.

---

## App Privacy ("nutrition label") answers

Map these when filling **App Privacy** in App Store Connect. All items are
**linked to identity** and used for **App Functionality** only — not tracking,
not advertising.

| Data type | Collected? | Notes |
|---|---|---|
| Contact Info → Email address | Yes | Account login |
| Contact Info → Name | Yes | Profile |
| Health & Fitness → Fitness | Yes | Workouts, pace, distance, heart rate, effort — entered manually and/or read from Apple Health (HealthKit) |
| Health & Fitness → Health | Yes | Heart rate & workout distance read from Apple Health (read-only) to auto-log completed workouts |
| User Content → Other (messages) | Yes | Athlete–coach chat |
| User Content → Photos (avatar) | Only if you keep avatar upload | Optional profile image |
| Identifiers | User ID | Account identifier |
| Usage Data / Tracking | **No** | No analytics or tracking SDKs |
| Diagnostics | **No** | None collected |

For every "Yes": purpose = **App Functionality**, linked to user = **Yes**,
used for tracking = **No**.

**Apple Health (HealthKit) — declare accurately:** RecBuddy reads workouts,
running/cycling distance, and heart rate from Apple Health (read-only, `toShare:
[]`) to auto-log completed workouts. Apple prohibits using HealthKit data for
advertising or selling it — RecBuddy does neither; it's used only to log runs
against the plan and is uploaded to our backend so the athlete's coach sees the
completed workout. The privacy policy (`privacy-policy.md`) discloses this — the
same URL is required on the app's App Store page **and** is checked against the
HealthKit entitlement during review.

---

## App Review Information (sign-in + notes)

**Seed the demo account on submission day** — its dates are relative to the run
date, so re-run it before every resubmission too (a reviewer may also delete it):

```
# .env.prod: prod SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + REVIEW_PASSWORD
npm run seed:review
```

> **This repo is public. The password goes only into App Store Connect — never
> into this file or any commit.** App Review **will** reject a login-gated app
> without working credentials and visible content.

**Sign-in required** (App Store Connect → App Review Information):

| Field | Value |
|---|---|
| User name | `review-athlete@recbuddy.app` |
| Password | the `REVIEW_PASSWORD` the seed ran with |

**Notes** (paste as-is):
```
RecBuddy is a running-coaching app. This build is the athlete app; coaches
build training plans and message athletes from the RecBuddy web app.

Please sign in with the demo athlete account provided. It is pre-populated with
a two-coach team, a 14-week half-marathon plan (completed history, the current
week in progress, upcoming weeks), logged runs, and a coach chat, so no second
device or coach account is needed.

Where to look:
- Calendar tab: today's workouts, weekly mileage, week and month views. Tap a
  workout to see the coach's structure and notes; completed workouts show the
  logged results. "Mark as complete" logs a run.
- Chat tab: conversation with the coaching team (shared workouts, logged-run
  cards, plan adjustments). You can send messages and photos.
- Profile icon (top right) opens Settings: race goal, coaches, units, Apple
  Health, notifications, support, and terms.

Apple Health (optional): Settings > Connected services > Apple Health >
Connect requests READ-ONLY access to workouts, distance, heart rate, and
cycling power. Recorded runs and rides are then logged against the plan
automatically; activities that don't match a planned workout are offered for
confirmation. Health data is never written, sold, or used for advertising. The
app is fully usable if the Health prompt is declined.

Sign-up with a coach code: on the sign-in screen tap "Create an account with a
coach code" and enter APPREVIEW. Email confirmation is required. Athletes
without a code can use "No code? Sign up solo".

Account deletion: Settings > Account > "Delete account…", enter the password,
then confirm. You are welcome to test this on the demo account.
```
