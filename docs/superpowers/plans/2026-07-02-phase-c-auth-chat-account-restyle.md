# Phase C: Auth / Chat / Account Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the auth flow (brand login + 3-step signup wizard), chat thread view (volt bubbles, date separators, custom header), and account sheet (avatar header, card rows, red logout) to match the handoff reference images exactly.

**Architecture:** Inline view-logic (no new stores); all logic kept in the modified view files; enum values sourced from migration SQL (`athlete_level`: new/returning/experienced/competitive; `athlete_goal`: fit/first-race/pr/distance).

**Tech Stack:** SwiftUI iOS 17, Supabase-swift, existing RB design tokens (Theme.swift), XcodeGen project.yml.

---

## Confirmed enum values (from supabase/migrations/20260609234526_schema.sql)

- `athlete_level`: `'new'` | `'returning'` | `'experienced'` | `'competitive'`
- `athlete_goal`: `'fit'` | `'first-race'` | `'pr'` | `'distance'`
- Trigger metadata keys: `experience_level`, `primary_goal`
- UI→DB mappings: "New to running"→new, "Returning"→returning, "Experienced"→experienced, "Competitive"→competitive; "Get fit"→fit, "First race"→first-race, "Beat a PR"→pr, "Go longer"→distance

## File Map

| File | Action |
|------|--------|
| `RecBuddy/Views/Auth/AuthFlowView.swift` | **Rewrite** — brand wordmark + inline login form |
| `RecBuddy/Views/Auth/SignInView.swift` | **Delete** — logic absorbed into AuthFlowView |
| `RecBuddy/Views/Auth/InviteFlowView.swift` | **Rewrite** — 3-step wizard with wizard chrome |
| `RecBuddy/Views/Chat/ChatView.swift` | **Restyle** — custom header, date separators, volt input bar |
| `RecBuddy/Views/Chat/MessageRow.swift` | **Restyle** — volt my-bubbles, coach dark bubbles, timestamps, lime runcard |
| `RecBuddy/Views/Account/AccountSheet.swift` | **Restyle** — avatar header, card rows, red logout; add `plan: Plan?` param |
| `RecBuddy/Views/Calendar/CalendarView.swift` | **Update** — pass `plan: store.plan` to AccountSheet |

---

## Task 1: Rewrite AuthFlowView + delete SignInView

**Files:**
- Modify: `apps/athlete-ios/RecBuddy/Views/Auth/AuthFlowView.swift`
- Delete: `apps/athlete-ios/RecBuddy/Views/Auth/SignInView.swift`

- [ ] Write new AuthFlowView with: dark ZStack, brand wordmark HStack("Rec" lime + "Buddy" white) .system(44, .heavy).italic().fontWidth(.condensed), "UNLEASH YOURSELF" caption kerning 3 textMute, Spacer, inline sign-in form (RBLabel("EMAIL") + rbField, RBLabel("PASSWORD") + SecureField rbField, VoltButtonStyle LOG IN, error text, Forgot password? textMute button + resetSent label, Divider, "New to RecBuddy? **Create an account**" accent NavigationLink → InviteFlowView).
- [ ] Move submit() + forgot() logic from SignInView into AuthFlowView (copy verbatim, keep redirect config read).
- [ ] Add `.toolbar(.hidden, for: .navigationBar)` to hide default nav bar at root.
- [ ] Delete SignInView.swift from disk.
- [ ] Verify the file compiles (xcodebuild or xcodegen + build).

## Task 2: Rewrite InviteFlowView as 3-step wizard

**Files:**
- Modify: `apps/athlete-ios/RecBuddy/Views/Auth/InviteFlowView.swift`

- [ ] Restructure state: `@State var step = 1`, `sent = false`, `name/email/password/experienceLevel/primaryGoal/code/coachName/coachInitials/codeResolved/busy/error`. Keep existing `resolve()/signUp()/resend()` logic; update signUp() to pass `experience_level` + `primary_goal` in data dict.
- [ ] Add wizard chrome: top HStack with circle-chevron back button (`goBack()` method), 3-segment lime progress Capsules, "n/3" textMute counter.
- [ ] Step 1 "Create your account": subtitle, RBLabel("FULL NAME")+rbField, RBLabel("EMAIL")+rbField, RBLabel("PASSWORD")+rbField SecureField. Pinned CONTINUE disabled until name+email+password.count≥6.
- [ ] Step 2 "Your running": subtitle, RBLabel("EXPERIENCE LEVEL") + 4 radio cards (title+subtitle+circle radio, selected=accent border+lime check), RBLabel("PRIMARY GOAL") + 2×2 chip grid (icon+label, selected=accent border). Pinned CONTINUE disabled until both selected.
- [ ] Step 3 "Connect with your coach": subtitle, RBLabel("COACH INVITE CODE")+rbField uppercase, .onChange(of: code) debounce 700ms Task to call resolve() when trimmed.count≥4, inline "✓ Code matches **Coach {name}**" banner (lime checkmark, dark surface card), inline error. Pinned "START TRAINING" disabled until codeResolved.
- [ ] `.sent` screen: envelope.circle.fill icon, "Check your email" title, explainer text, Resend button (VoltButtonStyle non-prominent), "Go to sign in" → `dismiss()` popping to AuthFlowView. Add `@Environment(\.dismiss) var dismiss`.
- [ ] Add `.navigationBarBackButtonHidden(true)` + `.toolbar(.hidden, for: .navigationBar)` to hide system nav chrome.

## Task 3: Restyle ChatView + MessageRow

**Files:**
- Modify: `apps/athlete-ios/RecBuddy/Views/Chat/ChatView.swift`
- Modify: `apps/athlete-ios/RecBuddy/Views/Chat/MessageRow.swift`

- [ ] ChatView: remove NavigationStack wrapper. Wrap in ZStack(RB.bg.ignoresSafeArea()). Custom header: HStack with coach avatar circle 36pt (initials, RB.surface2), VStack(coach name bold, title/role caption in RB.accent). Coach computed from `store.senders[store.thread?.coachId ?? ""]`.
- [ ] Add `ChatItem` enum (separator(String) / message(Message)) and `chatItems` computed var that inserts date separators when the local-timezone day changes between consecutive messages. Add `isoToLocalDay(_:)` + `dayLabel(_:)` private helpers.
- [ ] Restyle message list: iterate `chatItems`, switch on separator (centered date Text in textFaint caption) vs message (MessageRow).
- [ ] Restyle input bar: rbField TextField + RB.accent circle 36pt send button with black arrow.up icon.
- [ ] MessageRow: my text bubbles → RB.accent bg, RB.onAccent text, cornerRadius 18. Coach bubbles → RB.surface bg, white text, cornerRadius 18. Add timestamp Text(timeLabel(m.createdAt)) in caption2 textFaint below each bubble.
- [ ] MessageRow runcard from `mine`: HStack of bold stats (dist+unit, pace, time, hr) in RB.onAccent on RB.accent bg, rounded 16. Runcard from coach: existing dark card. Add static ISO8601DateFormatter + DateFormatter for time parsing.

## Task 4: Restyle AccountSheet + update CalendarView

**Files:**
- Modify: `apps/athlete-ios/RecBuddy/Views/Account/AccountSheet.swift`
- Modify: `apps/athlete-ios/RecBuddy/Views/Calendar/CalendarView.swift`

- [ ] AccountSheet: add `let plan: Plan?` property. Replace Form with ZStack(RB.bg) + NavigationStack + ScrollView + VStack structure. Add `.presentationBackground(RB.bg)` + `.presentationDragIndicator(.visible)`.
- [ ] Header: centered avatar 56pt circle (initials, RB.surface2), name Text(.title2.bold()), email Text textMute. Done button in toolbar.
- [ ] Name edit section: RBLabel("YOUR NAME") + rbField TextField + conditional Save button (accent color, appears when name differs from profile.name). Error text below.
- [ ] Goal & plan row (if plan != nil): settingRow(icon: "target", title: "Goal & plan", subtitle: planCaption) — display only, no destination chevron needed but include it.
- [ ] Units row: RBLabel + segmented Picker (mi/km) on dark background.
- [ ] Join a coach section (if !hasCoach): keep existing logic styled with rbField + small volt accent Button.
- [ ] Red Log out pill: `.background(Color.red.opacity(0.15)).foregroundStyle(Color.red).clipShape(Capsule())`.
- [ ] Footer note as small textFaint caption.
- [ ] CalendarView: update `.sheet` call to `AccountSheet(profile: profile, plan: store.plan)`.

## Task 5: Verify

- [ ] Run `xcodegen generate` in `apps/athlete-ios/`.
- [ ] Run `xcodebuild test` — expect 27 tests green.
- [ ] Run `xcodebuild build` — expect zero errors.
- [ ] Screenshot the login screen to `/tmp/phaseC.png` via Simulator.
- [ ] Commit: `git add apps/athlete-ios && git commit -m "feat(athlete-ios): auth/chat/account restyle to reference design — brand login, 3-step signup wizard, volt chat"`.
