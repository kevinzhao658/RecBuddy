# Chat enhancements — implementation plan

Spec: `docs/superpowers/specs/2026-10-18-chat-enhancements-design.md`
Worktree: `../RecBuddy-chat` on `feat/chat-enhancements` (from `origin/dev`). The shared local Supabase stack is managed by the other session: never `supabase start/stop/db reset` from here. Apply new migrations with `npx supabase migration up --local` after the report-block migration is present.

Each phase ends green (tests listed) and as one commit (only when asked). The order runs from least to most risky, so each phase can merge on its own if needed.

## Phase 0 — Setup & rebase point
1. Copy gitignored config into the worktree:
   - `apps/athlete-ios/Config.dev.xcconfig` (+ `Config.local.xcconfig` for the local stack)
   - `apps/coach-web/.env.local` and `.env.localdb.local`
   - root `.env` and `.env.cloud`
2. `npm ci`, then `xcodegen generate`.
3. Run the vite dev server on port **5181** (5180 belongs to the other session).
4. **Wait for `feat/ugc-report-block` to be committed.**
   - Phases 2–4 build on its `can_access_thread`, `has_blocked` and context menu.
   - Phase 1 doesn't need it, so start there.
   - Once it's committed, rebase onto it (or onto `dev` once merged).
5. Run a read-only check on dev and prod (needs your OK): `select athlete_id, count(*) from message_threads group by 1 having count(*) > 1;` — this sizes the Phase 4 data migration.

## Phase 1 — Copy & paste (client-only)
**iOS**
- `Lib/MessageText.swift`: `copyText(message:unit:)` builds the plain-text summary per kind, plus `quotePreview(message:)` (reused in Phase 2).
- `Views/Chat/ComposerTextView.swift`: a `UIViewRepresentable` around a `UITextView` subclass. Image paste goes to an `onPasteImages([UIImage])` callback; text pastes normally. Height grows over 1–4 lines; it keeps the placeholder, focus binding and the current styling.
- `ChatView`:
  - swap the composer `TextField` for the new view, and route pasted images into `stageImages(_:)`, extracted from `stageImagesFromPicker`;
  - add a context menu for the athlete's own messages too (Copy);
  - coach messages get Copy above Report and Block;
  - photos get Copy Photo.
- Tests: `MessageTextTests`, covering every kind and both units.

**Coach-web**
- `lib/clipboard.ts`: `copyMessage(m, unit)`, plus `copyImage(signedUrl)` using canvas → PNG → `ClipboardItem`.
- `features/chat/MessageActions.tsx`: a hover/long-press action bar, starting with Copy.
- `ChatPanel.tsx`: textarea `onPaste` stages clipboard image files.
- Tests: `clipboard.test.ts`, plus paste staging in `ChatPanel.test.tsx`.

✅ `xcodebuild test` · `cd apps/coach-web && npx vitest run` · manual check of copy/paste both ways on the simulator and in a browser

## Phase 2 — Replies
**Migration A** `20261019120000_message_replies.sql`:
- `messages.reply_to_id`, plus an index on it;
- a same-thread guard trigger.

**iOS**
- `Message.replyToId`.
- `ChatStore.send`/`sendImage` take `replyTo:`.
- `ChatView`: `@State replyingTo`, a reply bar above the input, and **Reply** in both menus.
- `MessageRow`: a `QuoteView` above the content, with tap → `scrollTo` + highlight.
- WorkoutDetailSheet: **Message coach about this** → switches to the Chat tab with `pendingWorkoutQuote` (via `AppRouter`). Send attaches `workout_id`, and a text message with a `workout_id` renders a workout chip.

**Coach-web**
- `types.ts` + `sendMessage`/`sendImageMessages` take `replyToId`.
- `MessageItem`: quote block.
- `ChatPanel`: reply bar.
- Day view: **Message athlete about this**.

**Tests**
- `supabase/tests/replies.test.ts`: same-thread reply OK, cross-thread rejected, set null on delete.
- `MessageItem.test.tsx`: quote and "unavailable" state.
- iOS: quote preview text.

✅ all three test suites + manual

## Phase 3 — Reactions
**Migration B** `20261019130000_message_reactions.sql`:
- the table, the thread/blocks trigger, RLS, and the realtime publication.

**iOS**
- `Lib/Reactions.swift`: the `ReactionKind` enum (emoji, label) and a `summarize([Reaction], me:)` pure function.
- `ChatStore`:
  - load reactions alongside messages (`select … where thread_id`);
  - `react(messageId:kind:)` (upsert, or delete if the same kind);
  - a second realtime listener on `message_reactions` filtered by `thread_id`, plus a DELETE fallback.
- Menus: a `ControlGroup` palette row with your current reaction selected.
- `MessageRow`: reaction badge overlay, with tap → `ReactionsDetailSheet`.

**Coach-web**
- `lib/queries/reactions.ts`: `useReactions(threadId)`, `useReact()`, and realtime.
- `MessageActions`: a react button with a five-emoji popover.
- `MessageItem`: badge row with a who-reacted tooltip.

**Tests**
- `supabase/tests/reactions.test.ts`:
  - one per user, switch kind, remove;
  - a non-participant can't react;
  - blocked users can't react, and their reactions are hidden;
  - cascade on message delete.
- web: badges + toggle.
- iOS: `summarize`.

✅ all suites + manual (two clients live: react on iOS → appears on web without a refresh)

## Phase 4 — Private chats (largest)
**Migration C** `20261019140000_direct_threads.sql`:
1. `kind` column, default `'team'`, then dedupe existing data per the spec (oldest stays `team`, the rest become `direct`).
2. Drop `message_threads_athlete_id_coach_id_key` and add the two partial unique indexes.
3. `can_access_thread(_athlete, _coach, _kind)`. Recreate `threads_read`/`threads_write` (insert only `kind='team'`), `messages_*`, the `chat_images_*` storage policies, and the reaction policies from Phase 3.
4. `open_direct_thread(p_athlete_id, p_coach_id)`.
5. Rewrite `unread_message_counts()`; add `unread_by_thread()`.

**Backend**
- `notify-message`: select `kind`; for direct threads the title becomes `"<Coach> · private"`, and `thread_kind` goes in the payload.
- `demo-athlete.ts`: `kind: 'team'`, plus a short private exchange with Marcus.

**iOS**
- `Thread.kind`.
- `ChatShare.fetchOrCreateThread` filters `kind = 'team'`; add `openDirectThread(coachId:)`.
- `ChatStore`: a `selection` (`.team` / `.direct(coachId)`), `threads` from `unread_by_thread`, and `open(athleteId:selection:)`.
- `ChatView` header switcher menu with unread dots, plus the private subtitle.
- `AppRouter.openThreadId`, set from the push `thread_id` in `RecBuddyApp`; ChatView opens that thread.
- The reply flow from Phase 2 targets the currently open thread.

**Coach-web**
- `fetchThread` filters `kind='team'`; add `fetchDirectThread`/`useDirectThread` (RPC).
- `ChatPanel`: Team / Private tabs with per-thread unread from `unread_by_thread`; roster badges sum them.
- `shareWorkoutToChat`/`shareAdjustToChat` still target team.

**Tests** — `supabase/tests/direct_threads.test.ts`:
- isolation from assistants and other coaches;
- a removed or blocked coach loses access;
- only participants can open a private chat;
- one team chat per athlete;
- unread doesn't leak;
- storage policy for images in a private chat;
- the migration dedupe on a fixture with two threads.

Also update existing `rls.test.ts` / `get_team.test.ts` expectations if they assume one thread per pair. Web: ChatPanel tabs. iOS: switcher labels.

✅ all suites + manual:
- private chat with Marcus is invisible to Dani on web;
- a push for a private message opens that chat;
- removing Marcus hides it from him.

## Phase 5 — Legal + docs
- Privacy Policy "Communications" + "How your information is shared", and Terms "Your Content", in all three places; bump the dates.
- Update the legal page tests (`PrivacyPage.test.tsx`, `TermsPage.test.tsx`).
- `docs/appstore/listing.md`: **not touched** (the user has uncommitted edits there in the other checkout).

## Phase 6 — Verify & hand off
- `npm test` (supabase), coach-web `npx vitest run` + `npm run build` (typecheck), `xcodebuild test`.
- End-to-end pass on the simulator + web against the local stack.
- Screenshots of each feature for the PR.
- Rebase on `dev` (after report-block merges), rerun everything, then ask before commit/push → PR into `dev`.

## Risks
- **Thread dedupe on real data:** sized in Phase 0; the migration is written to be idempotent.
- **Composer rewrite (UITextView):** the most likely source of iOS regressions — focus, keyboard dismissal, growth. It's covered by a manual checklist.
- **Realtime DELETE events aren't filterable:** handled with an unfiltered refetch, since only primary keys are exposed.
- **Merge conflicts with report-block** in `ChatView.swift`, `CoachesView.swift` and the RLS policies: rebasing early (Phase 0.4) keeps them small.
