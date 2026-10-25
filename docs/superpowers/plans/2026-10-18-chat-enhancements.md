# Reactions and Conversations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add iMessage-style reactions and 1:1/group conversations to athlete iOS and coach web, on top of the copy/paste and replies already built on this branch.

**Architecture:** `message_threads` gains a `kind` (`team` or `chat`), with a new `thread_members` table for chats. Two definer functions, `can_read_thread` and `can_post_thread`, become the single access gate for every policy. Clients get an inbox from one RPC (`my_conversations`), create chats through `start_conversation`, and toggle reactions through `set_reaction`.

**Tech Stack:** Supabase Postgres (RLS, definer RPCs, realtime), Deno edge functions, SwiftUI (iOS 17), React + TanStack Query + Tailwind (coach web), vitest, Swift Testing.

**Spec:** `docs/superpowers/specs/2026-10-18-chat-enhancements-design.md`

## Global Constraints

- **Worktree and branch:** `../RecBuddy-chat` on `feat/chat-enhancements`, based on `origin/dev` (`eb36f8d`). Never edit the main checkout.
- **Local database:** shared with other sessions. Apply each migration with `docker exec -i supabase_db_RecBuddy psql -U postgres -v ON_ERROR_STOP=1 -q < <file>`, and never `db reset`, start, stop or re-seed.
- **Migration filenames:** start after `20261019120000`, in order:
  1. `20261019130000_conversations.sql`
  2. `20261019140000_conversation_rpcs.sql`
  3. `20261019150000_conversation_lifecycle.sql`
  4. `20261019160000_message_reactions.sql`
- **Reaction kinds,** exactly `like`, `emphasize`, `question`, `laugh`, `congrats`, mapping to 👍 ‼️ ❓ 😂 🎉, in that order everywhere.
- **Groups** are capped at 25 members, and names pass `contains_blocked_term`.
- **Discoverability:** `profiles.discoverable_to_athletes boolean not null default true`. The Settings copy reads "Let my coach's other athletes find me".
- **Test simulator:** "RecBuddy Chat Test" `261042E6-D69C-458B-9E70-B31F766AD58A`. The coach web dev server runs with `npx vite --mode localdb --port 5181`.
- **Commits:** Conventional Commits with a scope, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit locally, and don't push.
- **Known old failures:** `coach-signup.test.ts` and `security.test.ts` (two-head-coach) fail on `dev` already and are not regressions.

## Review Focus

1. **Blocks in either direction:** adding someone while a block exists between the adder and the target must fail with a clear error, and `search_chat_people` must not list them (Task 2).
2. **Reusing a hidden 1:1:** starting a 1:1 you previously hid should return the same thread and unhide it, not create a duplicate (Task 2).
3. **Turning discoverability off while already in a group:** the athlete stays in existing groups and only disappears from new searches by athletes (Task 2).
4. **Athlete with no coach:** `my_conversations` returns no team row and the iOS inbox shows the empty state, not an error (Tasks 1 and 7).
5. **A new conversation started by someone else:** it appears in the other person's inbox live, without a manual refresh (Tasks 7 and 11).

---

### Task 1: Conversation schema and access gate

**Files:**
- Create: `supabase/migrations/20261019130000_conversations.sql`
- Test: `supabase/tests/conversations.test.ts`

**Interfaces:**
- Produces:
  - **Column changes:**
    - `message_threads.kind text` (`team`/`chat`), plus `title text`, `created_by uuid` and `read_only boolean`;
    - nullable `athlete_id`/`coach_id`, with check `(kind='team' and athlete_id is not null and coach_id is not null) or (kind='chat' and athlete_id is null and coach_id is null)`;
    - partial unique index `message_threads_one_team_per_athlete on (athlete_id) where kind='team'` replacing the old unique constraint.
  - **New table** `thread_members(thread_id uuid, user_id uuid, status text check in ('active','readonly','left','removed'), joined_at timestamptz default now(), last_read_at timestamptz, hidden_at timestamptz, primary key (thread_id, user_id))`, with RLS select only where `can_read_thread(thread_id)` and no direct writes.
  - **New column** `profiles.discoverable_to_athletes boolean not null default true`.
  - **Access functions:**
    - `can_read_thread(p_thread uuid) returns boolean`. For team it calls the existing `can_access_thread(athlete_id, coach_id)`. For chat it requires a member row with status `active` or `readonly`.
    - `can_post_thread(p_thread uuid) returns boolean`. Read access plus `not read_only`, plus status `active` for chats.
  - **Rewritten policies:** `messages_read` gets a `joined_at` cutoff for chats and keeps the existing `has_blocked(auth.uid(), from_user_id)` filter. Also rewritten: `messages_send` (`can_post_thread`), `messages_update` (`can_read_thread`), `threads_read`, `threads_write` (insert only `kind='team'`), the `chat_images_select` and `chat_images_insert` storage policies, and `report_content` (calls `can_read_thread(m.thread_id)`).
  - **Suspended accounts:** the admin console's `block_suspended_writes` trigger is extended to `thread_members`.
  - **`team_thread_id(p_athlete uuid) returns uuid`** gets or creates the team thread with the head coach. It raises `'no coach linked yet'` when there is none.

- [ ] **Step 1: Write failing tests** in `supabase/tests/conversations.test.ts`, suite `conversation access`, using `createAndSignIn` plus service-role inserts for setup:
  - `team thread still readable by athlete and team coaches; unchanged for strangers`;
  - `chat thread readable only by active/readonly members`, where a non-member select returns `[]` and a non-member insert errors;
  - `readonly member can read but not post`;
  - `member sees only messages after joined_at`;
  - `report_content works on a chat message for a member and fails ('message not found') for a non-member`;
  - `team_thread_id returns the same id twice and raises for an athlete with no coach`.
- [ ] **Step 2:** Run `npx vitest run supabase/tests/conversations.test.ts`. Expected: FAIL (column `kind` does not exist).
- [ ] **Step 3:** Write the migration. Set `kind='team'` on every existing row; dev and prod each have zero athletes with more than one thread (checked 2026-10-21).
- [ ] **Step 4:** Apply it with psql and rerun. Expected: PASS. Then run `npm test`. Expected: only the two known old failures.
- [ ] **Step 5:** Commit `feat(supabase): conversation threads, members, and a single read/post access gate`.

### Task 2: Conversation RPCs (search, start, edit, inbox)

**Files:**
- Create: `supabase/migrations/20261019140000_conversation_rpcs.sql`
- Test: `supabase/tests/conversations.test.ts` (new `describe` blocks)

**Interfaces:**
- Consumes: Task 1 tables and functions.
- Produces (all definer, `revoke from public, anon`, `grant to authenticated`):
  - **`can_add_to_chat(p_adder uuid, p_target uuid) returns boolean`**:
    - a coach adder may add coaches sharing an athlete, plus their own athletes;
    - an athlete adder may add their coaches, plus athletes sharing a coach whose `discoverable_to_athletes` is true;
    - it is false on any block in either direction, a suspended target, or `p_adder = p_target`.
  - **`search_chat_people(p_query text) returns table(user_id uuid, name text, initials text, avatar_url text, person_kind text, context text)`**:
    - `person_kind` is `coach` or `athlete`;
    - `context` is one of `Your athlete`, `Your coach`, `Coaches <athlete first name> with you`, or `Shares <coach first name> with you`;
    - it matches case-insensitively on name and returns at most 20 rows, ordered coaches first, then by name.
  - **`start_conversation(p_user_ids uuid[], p_title text default null) returns uuid`**:
    - it validates each id with `can_add_to_chat(auth.uid(), id)` and raises `'you can't add <name> to a chat'`;
    - it caps the group at 25 including the caller and runs the title through `contains_blocked_term`;
    - it reuses a chat whose set of active members exactly equals {caller} ∪ ids (clearing the caller's `hidden_at`), or else creates one.
  - **`add_conversation_members(p_thread uuid, p_user_ids uuid[]) returns void`** is for active members only. It applies the same per-id check by the caller and the cap, and a returning `left` member is reactivated with a new `joined_at`.
  - **`rename_conversation(p_thread uuid, p_title text) returns void`** is for active members; an empty title clears it.
  - **`leave_conversation(p_thread uuid) returns void`** works on chat threads with more than two members only. It raises `'use hide for a 1:1'` otherwise.
  - **`hide_conversation(p_thread uuid) returns void`** sets `hidden_at`. A new message in the thread clears `hidden_at` for every member (trigger on `messages` insert).
  - **`mark_thread_read(p_thread uuid) returns void`**:
    - for a chat it sets `last_read_at = now()`;
    - for a team thread it applies the existing per-message `read = true` update for messages not sent by the caller.
  - **`my_conversations() returns table(thread_id uuid, kind text, title text, team_athlete_id uuid, members jsonb, last_body text, last_kind text, last_from uuid, last_at timestamptz, unread int, read_only boolean)`**:
    - `members` lists the other readable members as `[{user_id,name,initials,avatar_url}]`;
    - it excludes hidden chats and orders team first, then by `last_at desc nulls last`.
  - **`unread_message_counts()`** is rewritten to count only threads the caller can read.

- [ ] **Step 1: Write failing tests**, one `it` per rule:
  - each `can_add_to_chat` branch;
  - `search excludes blocked users in both directions` (Review Focus 1);
  - `athlete with discoverability off is hidden from athlete search but addable by their coach`;
  - `turning discoverability off keeps existing group membership` (Review Focus 3);
  - `start_conversation reuses an identical member set and unhides a hidden 1:1` (Review Focus 2);
  - `rejects a 26th member`;
  - `rejects a filtered group name`;
  - `leave works for groups, errors for 1:1`;
  - `added member does not see messages before joining`;
  - `my_conversations lists team first, hides hidden chats, and counts unread per thread`;
  - `my_conversations returns no team row for an athlete without a coach` (Review Focus 4);
  - `unread_message_counts ignores chats the coach is not in`.
- [ ] **Step 2:** Run. Expected: FAIL (functions missing).
- [ ] **Step 3:** Write the migration.
- [ ] **Step 4:** Apply and run. Expected: PASS. Then run the full suite as in Task 1.
- [ ] **Step 5:** Commit `feat(supabase): conversation RPCs for search, start, membership, and inbox`.

### Task 3: Lifecycle on coach removal and block

**Files:**
- Create: `supabase/migrations/20261019150000_conversation_lifecycle.sql`
- Test: `supabase/tests/conversations.test.ts`

**Interfaces:**
- Produces:
  - **An `after delete on coach_athlete` trigger.**
    - A 1:1 chat whose two members are that coach and athlete gets `read_only=true`, and both members become `readonly`.
    - The coach's membership in groups containing the athlete becomes `removed`.
  - **An `after insert on coach_athlete` trigger** reverses the 1:1 case: `read_only=false` and both members back to `active`.
  - **`block_user`,** redefined with today's body plus one addition: the blocked person's membership in a 1:1 with the blocker becomes `removed` and the thread becomes `read_only`.

- [ ] **Step 1: Write failing tests:**
  - `removing a coach makes their 1:1 with the athlete read-only for both`;
  - `removing a coach takes them out of groups with that athlete but the group continues`;
  - `re-linking reactivates the 1:1`;
  - `blocking removes the blocked person from the 1:1 and leaves it read-only for the blocker`;
  - `in a shared group the blocker no longer sees the blocked person's messages`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Write the migration.
- [ ] **Step 4:** Apply and run. Expected: PASS. Then run `supabase/tests/report_block.test.ts`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(supabase): conversation membership follows coach removal and blocks`.

### Task 4: Reactions table and toggle

**Files:**
- Create: `supabase/migrations/20261019160000_message_reactions.sql`
- Test: `supabase/tests/reactions.test.ts`

**Interfaces:**
- Produces:
  - **The `message_reactions` table** has `message_id`, `user_id`, `thread_id` (filled by a before-insert trigger from the message), `kind` (checked against the five) and `created_at`, with primary key `(message_id, user_id)`.
    - It is added to `supabase_realtime`.
    - RLS select is allowed when `can_read_thread(thread_id) and not has_blocked(auth.uid(), user_id)`, with no direct writes.
    - It is added to `block_suspended_writes`.
  - **`set_reaction(p_message uuid, p_kind text) returns text`** returns the new kind, or null when the same kind removed it. It requires `can_post_thread` on the message's thread, rejects a block between the reactor and the author, and validates `p_kind`.
- [ ] **Step 1: Write failing tests:**
  - `one reaction per user, switching kind replaces it, same kind removes it`;
  - `non-member cannot react or read reactions`;
  - `readonly member cannot react`;
  - `reactions from a blocked user are hidden from the blocker`;
  - `invalid kind is rejected`;
  - `deleting a message removes its reactions`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Write the migration.
- [ ] **Step 4:** Apply and run. Expected: PASS.
- [ ] **Step 5:** Commit `feat(supabase): message reactions with a single toggle RPC`.

### Task 5: Push for chats and reactions

**Files:**
- Modify: `supabase/functions/notify-message/index.ts` (recipient selection)
- Create: `supabase/functions/notify-reaction/index.ts`, plus `[functions.notify-reaction] verify_jwt = false` in `supabase/config.toml`
- Create: `supabase/functions/notify-message/recipients.ts` (pure TS, no Deno imports), with test `supabase/tests/notify_recipients.test.ts` (vitest, since Deno isn't installed locally)

**Interfaces:**
- Produces:
  - **`recipients(thread: {kind, athlete_id}, members: {user_id, status}[], fromUserId): string[]`:**
    - for team it returns `[athlete_id]` unless the athlete sent it;
    - for chat it returns active member ids except the sender.
  - **`notify-reaction`** is guarded by `x-webhook-secret` like `notify-message`. Its alert has title = the reactor's name and body = `"<emoji> your message"`, it is sent only to the message author, and it is skipped when the author reacted to their own message or has blocked the reactor.
  - **The payload** for both carries `thread_id`.
- [ ] **Step 1:** Write `recipients.test.ts` for the team/athlete-sender, team/coach-sender and chat cases (sender excluded, `readonly`/`left` excluded).
- [ ] **Step 2:** Run `npx vitest run supabase/tests/notify_recipients.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement `recipients` and use it in `notify-message` for the title (group title or sender name), then implement `notify-reaction`.
- [ ] **Step 4:** Run the vitest file. Expected: PASS. Type-check both functions with `npx supabase functions serve` boot logs on the local stack (no `deno` binary).
- [ ] **Step 5:** Commit `feat(supabase): push chat messages to members and reactions to authors`.
- Note for deploy (record it in the PR, don't do it): a dashboard Database Webhook on `message_reactions` INSERT is needed on dev and prod, with the same secret as `notify-message`.

### Task 6: iOS data layer

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Lib/Conversations.swift` (models plus pure helpers)
- Create: `apps/athlete-ios/RecBuddy/Stores/ConversationsStore.swift`
- Modify: `apps/athlete-ios/RecBuddy/Stores/ChatStore.swift` (open by thread, reactions), `Stores/ChatShare.swift` (use `team_thread_id`)
- Test: `apps/athlete-ios/RecBuddyTests/ConversationsTests.swift`

**Interfaces:**
- Produces:
  - **Model types:**
    - `struct Conversation: Decodable, Identifiable` mirrors the `my_conversations` columns in camelCase and adds `var displayTitle: String` (title, else member first names joined with ", " or " & " for two, with "Team chat" as the label for team);
    - `struct ChatPerson: Decodable, Identifiable` mirrors `search_chat_people`;
    - `enum ReactionKind: String, CaseIterable { case like, emphasize, question, laugh, congrats; var emoji: String }`;
    - `struct Reaction: Decodable { messageId, userId, kind }`.
  - **`enum ReactionSummary { static func badges(_ rs: [Reaction], messageId: String) -> [ReactionKind]; static func count(...) -> Int; static func mine(_:, messageId:, me:) -> ReactionKind?; static func names(...) -> [(name: String, kind: ReactionKind)] }`.**
  - **`@Observable @MainActor final class ConversationsStore`** has:
    - `var conversations: [Conversation]`;
    - `func load() async`;
    - `func search(_ q: String) async -> [ChatPerson]`;
    - `func start(userIds: [String], title: String?) async throws -> String`;
    - `func rename / add / leave / hide(threadId:)`;
    - a realtime subscription on `thread_members` and `messages` that reloads (Review Focus 5).
  - **`ChatStore.open(threadId: String, me: String) async`** replaces `open(athleteId:)`, and also loads reactions.
    - `func react(messageId: String, kind: ReactionKind) async throws` calls `set_reaction`.
    - `var reactions: [Reaction]`, plus a realtime subscription on `message_reactions` filtered by `thread_id`.
    - `markRead` calls `mark_thread_read`.
- [ ] **Step 1:** Write `ConversationsTests` for:
  - decoding a `my_conversations` row;
  - the `displayTitle` cases (team, named group, 1:1, two people, three people);
  - `ReactionSummary` ordering in the canonical kind order, counts, and `mine`.
- [ ] **Step 2:** Run `xcodebuild test` on the test simulator. Expected: FAIL (types missing).
- [ ] **Step 3:** Implement the types and stores, and update the existing `ChatView`/`LogRunSheet` callers to compile against `open(threadId:)` via `team_thread_id`.
- [ ] **Step 4:** Run the tests. Expected: all pass (107 plus new).
- [ ] **Step 5:** Commit `feat(athlete-ios): conversation and reaction data layer`.

### Task 7: iOS inbox and thread routing

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Views/Chat/ChatsView.swift`
- Modify:
  - `App/RootView.swift:113` (tab 1 shows `ChatsView`)
  - `Views/Chat/ChatView.swift` (init takes `threadId` and an optional `Conversation`; the header shows the conversation title and members; a read-only banner "This conversation is read-only." replaces the composer)
  - `Push/AppRouter.swift` (`openThreadId: String?`)
  - `App/RecBuddyApp.swift` (set `openThreadId` from the push `thread_id`)

**Interfaces:**
- Consumes: `ConversationsStore`, `ChatStore.open(threadId:me:)`.
- Produces:
  - **`ChatsView(profile:)`** is a NavigationStack list matching the approved mockup:
    - the large "Chats" title and the ✎ toolbar button that opens `NewMessageView` (Task 8);
    - a search field filtering loaded conversations;
    - the pinned team row with the "TEAM CHAT" eyebrow;
    - lime unread dots, swipe to Hide on 1:1s;
    - the existing no-coach empty state copy when the list is empty.
  - **Routing:** `router.openThreadId` pushes that thread.
- [ ] **Step 1:** Build and run on the test simulator against the local stack. Sign in as `review-athlete@recbuddy.app` with `LOCAL_TEST_PASSWORD` from the main checkout's `.env.local`.
- [ ] **Step 2: Verify by screenshot:**
  - the inbox shows the team chat pinned;
  - tapping opens the thread with replies, copy and report still working;
  - a chat started from coach web (Task 12) appears without pulling to refresh (Review Focus 5).
- [ ] **Step 3:** Run `xcodebuild test`. Expected: PASS.
- [ ] **Step 4:** Commit `feat(athlete-ios): Messages-style chat inbox`.

### Task 8: iOS compose, conversation info, discoverability

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Views/Chat/NewMessageView.swift`, `Views/Chat/ConversationInfoView.swift`
- Modify: `Views/Account/AccountSheet.swift` (`preferencesSection` toggle bound to `profiles.discoverable_to_athletes`)
- Test: `RecBuddyTests/ConversationsTests.swift` (`ComposeSelection` rules)

**Interfaces:**
- Produces:
  - **`struct ComposeSelection`** holds `people: [ChatPerson]`, with `var isGroup: Bool` (two or more), `var athleteCount: Int` and `var showsAthleteNote: Bool` (athleteCount ≥ 2).
  - **`NewMessageView`** matches the approved compose mockup:
    - the To: field with lime pills;
    - results grouped YOUR COACHES / ATHLETES;
    - the note "Athletes in this group will see each other's names and messages.";
    - the first message composer;
    - Send calls `start` and then navigates to the thread.
  - **`ConversationInfoView`** shows members, a name field (groups), Add People (reusing the picker), Leave Conversation (groups, confirm dialog) and Hide (1:1). It is reached by tapping the chat header.
- [ ] **Step 1:** Write `ComposeSelection` tests.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the views and the toggle.
- [ ] **Step 4:** Run the tests. Expected: PASS. Then verify on the simulator:
  - start a 1:1 with Marcus and a group with Dani plus a second athlete;
  - rename, add and leave;
  - the toggle persists after relaunch;
  - searching the same people again opens the existing chat.
- [ ] **Step 5:** Commit `feat(athlete-ios): compose, conversation info, and athlete discoverability`.

### Task 9: iOS reactions UI

**Files:**
- Create: `apps/athlete-ios/RecBuddy/Views/Chat/ReactionBadge.swift`, `Views/Chat/ReactionsDetailSheet.swift`
- Modify: `Views/Chat/MessageRow.swift` (overlay badge at the top corner: top-trailing for theirs, top-leading for mine), `Views/Chat/ChatView.swift` (`messageMenu` starts with `ControlGroup { five buttons }.controlGroupStyle(.palette)`, with the current kind selected)

**Interfaces:**
- Consumes: `ChatStore.reactions`, `react`, and `ReactionSummary`.
- [ ] **Step 1:** Verify on the simulator:
  - long-press shows the five-emoji palette above Reply;
  - tapping 🎉 adds the corner badge;
  - tapping 🎉 again removes it;
  - a reaction from coach web appears live;
  - tapping the badge lists names.
- [ ] **Step 2:** Run `xcodebuild test`. Expected: PASS.
- [ ] **Step 3:** Commit `feat(athlete-ios): tapback reactions with corner badges`.

### Task 10: Coach web data layer

**Files:**
- Create: `apps/coach-web/src/lib/queries/conversations.ts`, `src/lib/queries/reactions.ts`, `src/lib/reactions.ts`
- Modify: `src/lib/types.ts`, `src/lib/queries/chat.ts` (`fetchThread` → `team_thread_id`; `markThreadRead` → `mark_thread_read`)
- Test: `src/lib/reactions.test.ts`, `src/lib/queries/conversations.test.ts`

**Interfaces:**
- Produces:
  - **TS types** mirror Task 6 (`Conversation`, `ChatPerson`, `ReactionKind`, `REACTIONS: {kind, emoji}[]` in canonical order).
  - **`summarize(rs: Reaction[], messageId: string, meId: string): {kind, emoji, count, mine, names: string[]}[]`.**
  - **Hooks:**
    - `useConversations()` (with realtime invalidation on `thread_members` and `messages`), `useSearchPeople(q: string)`;
    - `useStartConversation()`, `useRenameConversation()`, `useAddMembers()`, `useLeaveConversation()`, `useHideConversation()`;
    - `useReactions(threadId)` (realtime on `message_reactions` filtered by `thread_id`, plus an unfiltered DELETE refetch), `useSetReaction(threadId)`.
  - **`conversationTitle(c: Conversation, meId: string): string`**, same rules as iOS `displayTitle`.
- [ ] **Step 1:** Write tests for `summarize` (canonical order, `mine`, names) and `conversationTitle`.
- [ ] **Step 2:** Run `npx vitest run src/lib`. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS. Then run `npx tsc -b`. Expected: no errors.
- [ ] **Step 5:** Commit `feat(coach-web): conversation and reaction queries`.

### Task 11: Coach web Messages page

**Files:**
- Create: `src/features/messages/MessagesPage.tsx`, `ConversationList.tsx`, `ThreadView.tsx` (extracted from `ChatPanel.tsx`; takes `threadId`), plus `MessagesPage.test.tsx`
- Modify:
  - `src/App.tsx` (routes `/coach/messages` and `/coach/messages/:threadId` under `RequireCoach`)
  - `src/features/roster/RosterSidebar.tsx` ("Messages" item at the top with the unread total)
  - `src/routes/CoachPage.tsx` (the "Message" button and "Message athlete about this" navigate to `/coach/messages/<team thread id>`, carrying the workout in router state)
  - Delete `src/features/chat/ChatPanel.tsx` once `ThreadView` replaces it; the tests move to `ThreadView.test.tsx`.

**Interfaces:**
- Consumes: Task 10 hooks.
- Produces: the layout from mockup A (the list pane with "✎ New message" on top, then the thread pane with a header of title, members and an info button). `ThreadView({ threadId, initialWorkout? })`.
- [ ] **Step 1:** Move the `ChatPanel` tests to `ThreadView`, and add `MessagesPage` tests:
  - the list renders team first;
  - clicking a row selects it;
  - a read-only thread shows the banner instead of the composer;
  - a new conversation appears after a realtime event (Review Focus 5).
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the suite. Expected: PASS. Then in the browser (port 5181, magic-link sign-in as Marcus), confirm the sidebar badge, list and thread work, and that "Message athlete about this" lands in the team thread with the workout attached.
- [ ] **Step 5:** Commit `feat(coach-web): Messages page with conversation list`.

### Task 12: Coach web compose and conversation info

**Files:**
- Create: `src/features/messages/ComposePane.tsx`, `ConversationInfo.tsx`, with tests

**Interfaces:**
- Consumes: `useSearchPeople`, `useStartConversation`, and the membership hooks.
- Produces: the To: field with pills, results grouped ATHLETES / COACHES with context lines, the multi-athlete note (same copy as iOS), and an info drawer with members, rename, add, leave and hide.
- [ ] **Step 1: Write tests:**
  - typing queries `useSearchPeople`;
  - picking two athletes shows the note;
  - Send with an existing member set navigates to the returned id;
  - Leave is hidden for 1:1s.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run tests and `tsc`. Then in the browser, start a group with Maya, a second athlete and Dani, and confirm it appears in Maya's iOS inbox.
- [ ] **Step 5:** Commit `feat(coach-web): compose and conversation info`.

### Task 13: Coach web reactions (Slack chips)

**Files:**
- Create: `src/features/chat/ReactionChips.tsx`, with tests
- Modify: `src/features/chat/MessageItem.tsx` (chips row under the bubble; the full row of five visible on `group-hover/msg`), `ThreadView.tsx` (pass `summarize` output plus `onReact`)

**Interfaces:**
- Produces: `ReactionChips({ items, onToggle, showAll }: { items: ReturnType<typeof summarize>; onToggle: (k: ReactionKind) => void; showAll: boolean })`. A chip has `title` = names joined with ", ", and your chip gets the lime outline.
- [ ] **Step 1: Write tests:**
  - used chips always render with counts;
  - unused kinds render only when `showAll`;
  - click calls `onToggle`;
  - the `title` lists names.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run tests. Then in the browser, react on web and see the iOS corner badge update live, and the reverse.
- [ ] **Step 5:** Commit `feat(coach-web): Slack-style reaction chips`.

### Task 14: Coach web report and block

**Files:**
- Create: `src/lib/queries/moderation.ts` (`reportContent`, `blockUser`, `unblockUser`, `useBlockedUsers`, calling the existing RPCs and table), `src/features/chat/ReportDialog.tsx`, and a Blocked list in `src/features/settings/SettingsModal.tsx`
- Modify: `ThreadView.tsx` (actions "Report" and "Block <name>" for other people's messages, with confirmation copy matching iOS)

**Interfaces:**
- Consumes: the existing `report_content`, `block_user`, `get_blocked_users` and `user_blocks` delete.
- [ ] **Step 1: Write tests:** the report dialog requires a reason and submits `report_content` with `p_message_id`; block confirms and then calls `block_user`; the Blocked list unblocks.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run tests. Then in the browser, report a message and confirm it lands in `content_reports`.
- [ ] **Step 5:** Commit `feat(coach-web): report and block in conversations`.

### Task 15: Legal docs, seed, and full verification

**Files:**
- Modify:
  - `docs/appstore/privacy-policy.md`, `apps/coach-web/src/routes/legal/PrivacyPage.tsx` and its test
  - `docs/appstore/terms.md`, `TermsPage.tsx` and its test, `apps/athlete-ios/RecBuddy/Views/Account/TermsView.swift` (dates → October 2026; the Privacy date → the commit date)
  - `supabase/scripts/lib/demo-athlete.ts` (team thread `kind: 'team'`, plus one 1:1 with Marcus and one group "Saturday long-run crew")
- Content per the spec's Legal section. The App Store label is unchanged.
- [ ] **Step 1:** Update the legal test assertions for the new sentences, then run. Expected: FAIL, then update the docs. Expected: PASS.
- [ ] **Step 2:** Run everything:
  - `npm test` (the two known old failures only);
  - coach web `npx vitest run` and `npm run build`;
  - `xcodebuild test`.
- [ ] **Step 3:** Run the end-to-end pass on the simulator and in the browser, covering each Review Focus item. Save screenshots for the PR.
- [ ] **Step 4:** Commit `docs(legal): conversations, group chats, and athlete discoverability`, then ask Kevin before any push or PR.
