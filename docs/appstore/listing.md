# RecBuddy — App Store Listing Copy (v1.1)

Draft copy for App Store Connect. Character limits noted; counts are approximate —
verify in App Store Connect, which enforces them. Bracketed `[…]` items are
placeholders to fill before submitting.

---

## App name (max 30)
`RecBuddy`  *(8)*

> Must be globally unique on the App Store. If "RecBuddy" is taken, fall back to a
> qualified name, e.g. `RecBuddy: Run Coaching` *(23)* or `RecBuddy Running` *(16)*.

## Subtitle (max 30)
`Training you can trust`  *(22)*

Alternatives:
- `Coaching tailored to you`  *(24)*
- `Live coaching for you`  *(21)*

## Promotional text (max 170) — editable anytime without a new build
`Training plans built by real coaches just for you. Get a running plan built for your
goal, log every run, and message your coach when the plan needs to flex.`  *(157)*

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

Your coach builds a training plan around your running goal, whether that's your first
5K, a marathon PR, or just running more consistently. Every workout shows up on
your calendar with the distance, pace, and detail you need. Log how the run
actually went, and your coach sees it — so the plan adapts to real life instead
of ignoring it.

WHY RECBUDDY

• A plan built by your coach, for your running goals
• See every workout on a clean weekly calendar
• Log your runs: distance, pace, time, heart rate, and how it felt
• Sync with Apple Health — completed runs and rides log themselves automatically
• Chat with your coach, your coaching team, and training partners
• Share photos and short videos: send form checks and race moments
• React to messages, reply to a specific one, and edit or delete your own
• Get workouts adjusted in the chat when life gets in the way
• Report or block anyone, any time
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

## What's New (version 1.1)
```
Chat got a big upgrade:
• Group chats with your coaching team and training partners
• Send short videos (up to 60 seconds) as well as photos
• React to messages, reply to a specific one, and edit or delete your own
• Rename a chat, add or remove people, and see who's in it
• Report a message or block someone right from the chat

Also new:
• Apple Health: confirm an activity that didn't match a planned workout, and
  synced runs no longer show up twice
• A new opening animation
• A Privacy Policy link in Settings
```

---

## App Store Connect metadata checklist

| Field | Value |
|---|---|
| Primary category | Health & Fitness |
| Secondary category (optional) | Sports |
| Age rating | Complete the questionnaire and target **13+**. Answer **Yes** to Messaging and Chat (coach and team chat) and **Yes** to User-Generated Content (messages, photos, videos). Report/block, the blocked-terms filter, and 24-hour report review are the moderation to cite. Don't aim for 4+, because the Terms (§2) require users to be at least 13. If the calculated rating comes out below 13+, pick 13+ where App Store Connect allows a higher rating. |
| Price | Free *(confirm)* |
| Privacy Policy URL | `https://recbuddy.app/privacy` *(host `privacy-policy.md`)* |
| Support URL | `https://recbuddy.app/support` *(or a contact page)* |
| Marketing URL (optional) | `https://recbuddy.app` |
| Copyright | `2026 Kevin Zhao` *(change if you file under a business entity)* |
| Contact email (App Review) | `kevinzhao658@gmail.com` *(private to Apple; support@recbuddy.app is the public one)* |

## Screenshots (iPhone only)
The 1.1 set lives in `screenshots/iphone-6.9/` (1320×2868, iPhone 17 Pro Max
simulator, demo athlete data). Upload in file order. App Store Connect scales
the 6.9" set down for smaller iPhones, so the older `iphone-6.5/` set (1.0, Sep
2026) is not needed for 1.1.

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
| User Content → Other User Content | Yes | Chat messages, reactions, and reports a user submits |
| User Content → Photos or Videos | Yes | Photos and videos sent in chat, and the optional profile photo |
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

**Notes** (paste as-is). Apple's 2.1 "Information Needed" (Sep 13) asked for these six items both here and as a reply in the submission thread, with a screen recording from a physical iPhone attached:
```
RecBuddy is a running-coaching app. This build (1.1) is the athlete app; coaches build training plans and message athletes from the RecBuddy web app.

1. SCREEN RECORDING
Attached, recorded on a physical iPhone running the latest iOS. It starts at launch and shows sign-up with a coach code, login with the demo account, the calendar and logging a run, chat (photos, videos, reactions, replies), reporting a message, blocking a user, and account deletion.

2. PURPOSE AND AUDIENCE
RecBuddy connects runners (13+, beginners to competitive racers) with their running coach. Coaches build personalized plans on the web; athletes use this app to see each day's workouts, log results (manually or from Apple Health), and message their coaching team. It replaces the spreadsheets and scattered texts most coached runners rely on with one shared plan and conversation.

3. HOW TO ACCESS THE APP
Sign in with the demo athlete in Sign-In Information. It has a two-coach team, a 14-week half-marathon plan, logged runs, a team chat, and a direct message, so no second device or coach account is needed.
- Calendar tab: today's workouts, weekly mileage, week and month views. Tap a workout for the coach's structure and notes; "Mark as complete" logs a run.
- Chat tab: the inbox. Send text, photos, and videos (up to 60 s; removed from our servers after 7 days). Press and hold a message to react, reply, copy, edit or delete your own, or report someone else's. Tap the names at the top for Chat Details (rename, add or remove people, block, leave).
- Profile icon (top right): Settings with race goal, coaches, units, Apple Health, notifications, support, Terms, and Privacy Policy.
Apple Health (optional): Settings > Connected services > Apple Health requests READ-ONLY access to workouts, distance, heart rate, and cycling power to log runs and rides against the plan. The app is fully usable if declined.
Sign-up: on the sign-in screen tap "Create an account with a coach code" and enter APPREVIEW (email confirmation required), or "No code? Sign up solo".
Account deletion: Settings > Account > "Delete account…", enter the password, confirm. You may test it on the demo account.

4. EXTERNAL SERVICES
- Supabase: database, authentication and auth emails, file storage (photos and videos), realtime messaging, serverless functions (account deletion, push, video cleanup).
- Resend: delivers safety-report notifications to our support team.
- Apple HealthKit (optional, read-only) and Apple Push Notification service.
- Vercel: hosts the coach web app and legal pages.
No AI services, payments, analytics, or advertising SDKs.

5. REGIONAL DIFFERENCES
None; the app works the same in every region.

6. REGULATED INDUSTRY / THIRD-PARTY MATERIAL
Not applicable. RecBuddy is a fitness tool, not a medical service, and has no protected third-party content. Health data is read only with permission and never written, sold, or used for advertising.

USER-GENERATED CONTENT AND SAFETY
Conversations are visible only to their members; there are no public posts. Athletes who share a coach can find each other to start a chat, which can be turned off in Settings. Any message or user can be reported in the app (press and hold a message, or Settings > Coaches); reports reach our support team and are reviewed within 24 hours. Blocking stops a user from messaging you and removes them from your team. Messages with prohibited language are refused automatically, and the Terms (zero tolerance for objectionable content) allow us to remove content and suspend accounts.
```
