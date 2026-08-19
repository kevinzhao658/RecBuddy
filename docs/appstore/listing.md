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

Questions or feedback? Reach us at [support@recbuddy.app].
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
| Copyright | `2026 [Your name]` |
| Contact email (App Review) | `[support@recbuddy.app]` |

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
| Health & Fitness → Fitness | Yes | Workouts, pace, distance, heart rate, effort (manually entered) |
| User Content → Other (messages) | Yes | Athlete–coach chat |
| User Content → Photos (avatar) | Only if you keep avatar upload | Optional profile image |
| Identifiers | User ID | Account identifier |
| Usage Data / Tracking | **No** | No analytics or tracking SDKs |
| Diagnostics | **No** | None collected |

For every "Yes": purpose = **App Functionality**, linked to user = **Yes**,
used for tracking = **No**.

---

## Reviewer notes (App Review Information → Notes)
```
RecBuddy is a two-sided running-coaching app. This build is the athlete app;
athletes connect to a coach via an invite code.

A demo athlete account is provided below, pre-populated with a coach, an active
training plan, scheduled + logged workouts, and a chat thread so the full
experience is visible without needing a second (coach) account.

Login: [demo athlete email]
Password: [demo password]

Account deletion: Settings → Account → Delete account (requires password
re-entry).
```

> Fill in the demo credentials once the reviewer-demo account is seeded (next
> task). App Review **will** reject a login-gated app without working demo
> credentials and visible content.
