# Athlete iOS App (sub-project C) — v1 Design

**Goal:** a native SwiftUI iPhone app that closes the coaching loop — the athlete sees the plan their coach built in the coach web app, marks workouts done and logs real results, and chats with their coach. Pure client work: v1 requires **zero new backend** (all tables, RLS policies, and RPCs already exist and were verified against the schema).

## Scope

**In v1**
- Auth: sign in, invite-first signup with email confirmation, forgot-password (via the existing web `/reset-password` page)
- Calendar tab: view the assigned plan week-by-week, workout detail, mark done, log a run (manual actuals), optional share-to-chat
- Chat tab: message the coach team, render shared workout/run/adjust cards, realtime updates, read receipts
- Account sheet: name, mi/km unit toggle, sign out

**Not in v1** (v2 candidates): Metrics tab, HealthKit import, push notifications, offline cache, in-app password change / delete account (the web app covers both), magic links.

**Reference design:** `design_handoff_recbuddy/app/` mockups (login, signup, calendar, chat, ui, core). The `metrics.jsx` mockup is deferred with the Metrics tab.

## Project & tooling

- Location: `apps/athlete-ios/`
- **iOS 17.0+**, Swift 5.10+, SwiftUI, Observation framework (`@Observable`)
- **supabase-swift** via Swift Package Manager (auth, postgrest, realtime)
- **XcodeGen**: the Xcode project is generated from a committed `project.yml` (`xcodegen generate` after checkout); `*.xcodeproj` is gitignored. Declarative, diff-able, no binary project churn.
- Config: `Config.xcconfig` (gitignored) holds `SUPABASE_URL` / `SUPABASE_ANON_KEY`, surfaced to code via Info.plist build settings; committed `Config.example.xcconfig` documents it. Dev points at the dev Supabase project (`bawezljwxehadmkjeydw`); a prod build points at prod — same connection-vs-schema split as the web app.
- Bundle id `app.recbuddy.athlete`, display name **RecBuddy**.
- Developer machine prerequisite: full Xcode installed (`xcode-select` pointed at Xcode.app), `xcodegen` via Homebrew. Build/run via `xcodebuild` + `xcrun simctl` (CLI) or the Xcode GUI.

## Architecture

Mirrors coach-web's one-way layering, Swift-flavored:

```
Views/<feature>/   SwiftUI screens grouped by feature: Auth/, Calendar/, Chat/, Account/,
                   plus Components/ for shared presentational pieces (type icons, cards)
   ↓
Stores/            @Observable server-state stores — the TanStack Query role:
                   SessionStore  auth session + own profile + role gate
                   PlanStore     plan, workouts by week, mark-done, log-actuals
                   ChatStore     thread, messages, send, realtime subscription, mark-read
   ↓
Lib/               Supa.swift (client singleton) · Models.swift (Codable structs mirroring
                   profiles/plans/workouts/workout_actuals/message_threads/messages) ·
                   pure helpers ported from lib/*.ts: Week.swift (Monday-based week math,
                   local-time todayISO), Pace.swift (parse/format M:SS/mi), Units.swift
                   (mi/km conversion, canonical-/mi storage), EstMinutes.swift
```

Rules carried over from coach-web:
- Views never call Supabase; every remote call goes through a store.
- One client singleton (`Supa.shared`).
- Pure logic is pure, unit-tested functions.
- Split files by responsibility; ~150 lines is a review trigger, not a gate.
- **Pace is stored canonically as `M:SS/mi`**; the unit toggle only changes display (identical to the web).

`SessionStore` listens to `auth.authStateChanges` and drives the root switch:
- no session → auth flow
- session + `profile.role == 'athlete'` → main tabs
- session + any other role → "RecBuddy for athletes — sign in with an athlete account" screen with sign-out (the inverse of the web's `RequireCoach`).

## Screens & flows

### Onboarding (invite-first)
1. Landing: **Sign in** or **I have an invite code**.
2. Invite entry → `resolve_invite(code)` (anon-callable) → shows "You're joining {coach name}" with the coach's initials; invalid/consumed code shows an inline error.
3. Signup form (name, email, password) → `auth.signUp` with `user_metadata: { name }` — the existing DB trigger creates the profile with role `athlete`. No custom endpoint, no captcha in v1 (signup is gated by possessing a valid invite code; revisit if abuse appears).
4. "Check your email" screen with resend (same pattern as coach signup); Supabase **Confirm email** stays ON.
5. After confirmation + sign-in → `redeem_invite(code)` links the athlete to the coach as head and consumes the code (the code is held locally through the confirm step). Redeem failure (e.g. consumed meanwhile) shows a retry/enter-new-code screen — the account exists but is unlinked until redemption succeeds.
6. Land on Calendar.

Sign-in and forgot-password mirror the web (`signInWithPassword`, `resetPasswordForEmail` → the web reset page).

### Calendar tab
- Today-centered **week strip** (Mon–Sun, matching the web's Monday-based week math) with paging to past/future weeks; each day shows its workout card (type icon, title, dist/pace) and status tint (done/today/planned/missed/rest — same statuses as the web).
- Tap → **workout detail sheet**: type, title, distance + pace (unit-aware), est. duration, structure phases (`sets` label/detail rows), coach's note, and any logged actuals.
- **Mark done**: calls the existing `mark_workout_status(p_workout_id, p_status)` SECURITY DEFINER RPC (athlete-settable values: `done`/`planned` — undo supported), which restricts the write to the caller's own workout and the status column.
- **Log run**: form with distance, time, pace (auto-derived from distance+time, editable), avg HR, feel (1–5) → inserts `workout_actuals` (`source: 'manual'`) and marks the workout done. Optional **"Share to chat"** toggle posts a `runcard` message (`kind: 'runcard'`, payload `{title, dist, pace, time, hr}`) to the coach thread — the same shape the seed and coach app already render.
- Empty states: no plan yet → "Your coach hasn't built your plan yet"; rest day → rest card.

### Chat tab
- Single conversation with the coach team (thread = this athlete + head coach; co-coaches post into it, senders resolved by `from_user_id` → profile name/initials/avatar).
- Renders `text` bubbles plus read-only `workout`, `runcard`, and `adjust` cards (same visual language as the coach app's `MessageItem`, athlete-side styling: own messages accent-tinted right, coach messages left with avatar/name grouping and session-gap time headers).
- Send text; **realtime** via a Supabase Realtime channel on `messages` filtered by `thread_id` (the coach web's `useRealtimeThread` pattern).
- On open, mark coach-authored unread messages read (drives the coach app's unread badge).

### Account sheet
- Avatar + name (name editable → `profiles.name`), coach list, **mi/km** toggle persisted in `UserDefaults` (display-only, defaults to miles, like the web's localStorage), sign out. Password change / account deletion deliberately deferred to the web app in v1.

## Backend contract (all existing — verified)

| Need | Mechanism |
|---|---|
| Signup creates athlete profile | `auth.signUp` + existing `on_auth_user_created` trigger |
| Preview invite before signup | `resolve_invite(text)` — anon-callable RPC |
| Link to coach after confirm | `redeem_invite(text)` — authenticated RPC |
| Read own profile / coaches | `profiles` RLS (self + linked coaches) |
| Read plan + workouts | `plans_read` / `workouts_read` (`athlete_id = auth.uid()`) |
| Mark done / undo | `mark_workout_status(uuid, workout_status)` — authenticated RPC |
| Log actuals | `actuals_write` (`athlete_id = auth.uid()`) |
| Chat read/send/read-receipts | `threads_read` / messages policies (athlete + team) |
| Realtime messages | Supabase Realtime on `messages` (already used by coach web) |

## Error handling

- Each store exposes per-operation `phase` (`idle/loading/error(message)`); screens render inline retry affordances, never dead-ends.
- Auth/refresh failures (401) → `SessionStore` signs out to the auth flow.
- Mark-done is optimistic with rollback on failure; log-run and chat-send are pessimistic (spinner on the submit control, error inline).
- No offline support in v1: actions require connectivity and say so on failure.

## Testing

- **Swift Testing** unit tests for every ported pure helper (Week, Pace, Units, EstMinutes) — mirroring the TS test cases so both platforms agree on week boundaries and pace math.
- Store tests where practical behind a small `DataClient` protocol (stores depend on the protocol; tests inject a mock; `Supa` provides the live implementation).
- UI verification is manual in the iOS Simulator (CLI-driven builds); no XCUITest in v1.
- CI: none for iOS in v1 (macOS runners deferred); local build + tests before commits, same green-before-commit rule as the web app.

## Milestones (single plan, ordered)

1. Project scaffold: XcodeGen, config, Supabase client, models, ported helpers + tests — builds and signs in against dev
2. Auth flow: sign-in, invite onboarding, email-confirm wait, role gate
3. Calendar: week strip, workout cards, detail sheet, mark done
4. Log run: actuals form + share-to-chat
5. Chat: thread, cards, send, realtime, read receipts
6. Account sheet + polish pass (empty states, error states)
