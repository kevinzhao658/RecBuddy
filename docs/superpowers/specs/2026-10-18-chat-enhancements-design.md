# Chat enhancements — design

**Date:** 2026-10-18 · **Branch:** `feat/chat-enhancements` (worktree `../RecBuddy-chat`)
**Surfaces:** athlete iOS, coach-web, supabase (3 migrations), legal docs
**Depends on:** `feat/ugc-report-block` (migration `20261018120000`) — merges first; this branch rebases onto it.
**Ships in:** 1.1, after 1.0 is approved. Not part of the 1.0 (3) resubmission build.

## Goals

1. **Copy & paste** — copy any message; paste text or images into the composer.
2. **Tapback reactions** — 👍 ‼️ ❓ 😂 🎉 via press-and-hold, visible to everyone in the thread.
3. **Private chats** — a 1:1 thread between the athlete and one coach, alongside the team chat.
4. **Replies** — quote-reply to any message (including run/workout cards), and start a chat about a logged workout from the calendar.

Every feature works in both apps (athlete iOS + coach-web) and respects blocks.

## Today (what this builds on)

- **One thread per athlete.** `message_threads` is `unique (athlete_id, coach_id)` with `coach_id` = head coach; every coach on the team reads it through `is_coach_of`.
- **Thread lookup is by athlete only.** Both iOS `ChatShare.fetchOrCreateThread` and coach-web `fetchThread` select the first thread with `athlete_id = X`. This breaks once an athlete has two threads, so it must change to `kind = 'team'`.
- **Access is defined in one place.** After report-block, `can_access_thread(athlete, coach)` defines thread access for `messages`, `message_threads` and chat-image storage.
- **`unread_message_counts()` is a definer RPC.** It counts by `t.coach_id = me or is_coach_of(athlete)`, so it would leak other coaches' private threads unless it's updated.
- **`read` is a single per-message flag.** That stays as it is: accurate in private threads, shared across coaches in the team thread (an existing MVP limitation).
- **Realtime reloads the whole thread** on any message change, in both apps.
- **Push.** `notify-message` pushes coach→athlete messages with `thread_id`. The iOS inline reply already posts to that `thread_id`, but `AppRouter.openChat` only switches tabs.

## Design

### 1. Copy & paste (client-only, no backend)

**iOS**
- Long-press menu → **Copy**.
  - Text and image captions copy their text.
  - Workout, run and adjust cards copy a plain-text summary, e.g. `Tempo 6 mi — 6.0 mi · 7:42/mi · 46:12 · HR 158`, built by a pure `MessageText.copyText(_:unit:)` that's unit-tested.
  - Photos get **Copy Photo**: download the signed URL, then `UIPasteboard.general.image`.
- **Paste into the composer.**
  - SwiftUI's `TextField` can't accept image pastes, so the composer becomes a small `UIViewRepresentable` around a `UITextView` subclass.
  - It overrides `canPerformAction`/`paste(_:)`: when the pasteboard holds images, they go through the existing staging path (`ImageShrink.jpegForChat` → `StagedImage`, max 6); otherwise it pastes text as normal.
  - It keeps the current behavior: grows to 1–4 lines, focus binding, dismisses on scroll, same styling.

**Coach-web**
- A message action **Copy** uses `navigator.clipboard.writeText`. **Copy image** fetches the signed URL, redraws it as PNG on a canvas (browsers only accept `image/png` in `ClipboardItem`), then calls `clipboard.write`.
- The textarea gets an `onPaste` handler: image files in the clipboard are added to `staged` (same `MAX_PHOTOS` cap); text pastes normally.

### 2. Tapback reactions

**Schema** (migration B):

```sql
create table message_reactions (
  message_id uuid not null references messages(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  thread_id  uuid not null references message_threads(id) on delete cascade, -- denormalized for realtime filtering
  kind       text not null check (kind in ('like','emphasize','question','laugh','congrats')),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)          -- one reaction per person per message
);
```

- A `before insert` trigger fills `thread_id` from the message. It rejects reactions on messages from someone the reactor blocked, or by a reactor the thread's athlete blocked.
- **RLS:**
  - **Read:** `can_access_thread` on the parent thread, and the reactor isn't blocked by the reader.
  - **Insert, update, delete:** only your own rows (`user_id = auth.uid()`), and only on threads you can access.
- **Realtime:** add the table to `supabase_realtime`. Clients subscribe with `thread_id=eq.X` and refetch. Supabase can't filter DELETE events, so clients also refetch on an unfiltered delete. Only primary keys are exposed in those events, which is acceptable.
- **Toggling:** tapping your current reaction deletes it; tapping a different one upserts (replaces it).

**UI**
- **iOS:** the long-press `.contextMenu` gets a `ControlGroup { … }.controlGroupStyle(.palette)` row of five emoji at the top (iOS 17+, already our minimum), then Reply, Copy, and for coach messages Report and Block. Your current reaction is shown as selected.
- **Badges:** an overlapping capsule at the bubble's top corner, iMessage style, showing each emoji with its count. Tapping it opens a small sheet listing who reacted ("Dani 👍, You 🎉").
- **Coach-web:** a hover action bar on each message (react · reply · copy · ⋯) and long-press on touch devices. The same badge row sits under the bubble.
- **No push for reactions in v1.** It's quiet by default and easy to add later in `notify-message`.

### 3. Private chats

**Schema** (migration C):
- `message_threads.kind text not null default 'team' check (kind in ('team','direct'))`.
- **Replace** `unique (athlete_id, coach_id)` with partial unique indexes:
  - `unique (athlete_id) where kind = 'team'` — exactly one team chat per athlete;
  - `unique (athlete_id, coach_id) where kind = 'direct'` — one private chat per coach.
- **Existing data:** every current thread becomes `team`.
  - If an athlete already has more than one thread, the migration keeps the oldest as `team` and converts the rest to `direct` between that athlete and that thread's `coach_id`. Those coaches are the original participants, so nobody loses history.
  - A read-only count on dev and prod comes first, so the number affected is known before shipping.
- **Access** — `can_access_thread` gains the thread kind (a new 3-argument overload; every policy is recreated to use it):
  - **team:** unchanged — the athlete, plus team coaches not blocked by the athlete.
  - **direct:** the athlete, plus that one coach, and only while they are still on the athlete's team (`is_coach_of`) and not blocked. Removing or blocking the coach ends their access to the private chat, the same as the team chat. The athlete keeps the history.
- **Creating a chat:** `open_direct_thread(p_athlete_id, p_coach_id) returns uuid` (definer) gets or creates the thread.
  - The caller must be that athlete or that coach.
  - The coach must be on the team.
  - Neither may have blocked the other.
  - The `threads_write` insert policy only allows `kind = 'team'`, so direct threads are created only through this RPC.
- **Unread counts:**
  - `unread_message_counts()` is rewritten to use the new access check, so private chats count only for their own coach.
  - New `unread_by_thread()` returns `(thread_id, athlete_id, kind, coach_id, unread)`. It drives per-chat dots in both apps, including the iOS chat switcher, which has no unread data today.
- **Push:** `notify-message` already reads `thread_id`. For direct threads the alert title becomes `"Dani · private"`, and the payload adds `thread_kind`.
- **Things that stay in the team chat:**
  - Run cards shared from LogRunSheet (`ChatShare.shareRunCard`) and coach-web share-to-chat / adjust cards (`shareWorkoutToChat`, `shareAdjustToChat`). Both lookups change to `kind = 'team'`.
  - The seed script's chat (`demo-athlete.ts` inserts `kind: 'team'` explicitly), and optionally one short private exchange with Marcus for the demo.

**UI**
- **iOS ChatView:** the header becomes a switcher.
  - Tapping the title opens a menu: **Team chat** (all coaches) and **Private · Dani**, **Private · Marcus**, each with an unread dot. Picking a coach without a private chat yet creates it.
  - A selected private chat shows that coach's avatar and the subtitle "Private — only you and Dani".
  - `ChatStore.open` takes a thread selection.
  - `AppRouter` gains `openThreadId`, so tapping a push opens the right chat.
- **Coach-web ChatPanel:** two tabs, **Team** and **Private** (only your own private chat with this athlete), each with an unread badge. The roster badge sums both.

### 4. Replies

**Schema** (migration A): `messages.reply_to_id uuid references messages(id) on delete set null`. A `before insert` trigger rejects a reply that points at a message in a different thread.

**Rendering**
- A compact quote block sits above the bubble: a colored bar, the sender's name, and a one-line preview (text snippet, "📷 Photo", "Logged run · Tempo 6 mi", "Workout · Long Run 14 mi").
- Tapping the quote scrolls to the original and briefly highlights it.
- If the original was deleted or is hidden by a block, the quote shows "Original message unavailable".
- Both apps already load the whole thread, so the quote is resolved client-side and needs no extra fetch.

**Composer**
- **Reply** in the long-press menu sets `replyingTo`.
- A dismissible "Replying to Dani: …" bar appears above the input.
- The next text or photo send carries `reply_to_id`; for a batch of photos it goes on the first one.

**Replying to a logged workout**
- **In chat:** run cards and workout cards are messages, so Reply covers them.
- **From the calendar:** WorkoutDetailSheet (iOS) gets **Message coach about this**.
  - It opens the team chat with a workout quote attached to the composer. The message is sent as `kind = 'text'` with the existing `workout_id` column set, and renders a tappable workout chip.
  - The roll-up logic only touches `runcard`/`workout` kinds, so it's unaffected.
  - Coach-web gets the same action in the day view ("Message athlete about this").

### Blocks and moderation (from report-block)

- Reactions, replies and private chats all go through `can_access_thread` and `has_blocked`.
- The language filter already covers `messages.body`, so replies are filtered too. Reactions are a fixed set and need no filtering.
- Report and Block stay in the same long-press menu, below the new actions.

### Legal (CLAUDE.md gate, same PR)

Update all three copies — `docs/appstore/*.md`, `coach-web/src/routes/legal/*.tsx` and `TermsView.swift` — and bump the "Last updated" date:
- **Privacy Policy, "Communications":** add reactions, replies, and private messages between an athlete and one coach.
- **Privacy Policy, "How your information is shared":** team chat is visible to the whole coaching team; private chats only to that coach; access ends when a coach is removed or blocked.
- **Terms, "Your Content":** the license covers reactions and replies. No change to the App Store privacy label, since this is still "Other User Content".

## Testing

- **supabase/tests** (vitest, local stack):
  - an assistant can't read the head coach's private chat;
  - a removed or blocked coach loses private-chat access;
  - a third party can't open a private chat;
  - `unread_message_counts` doesn't leak private chats;
  - one team thread per athlete is enforced;
  - a cross-thread reply is rejected;
  - one reaction per user, changeable;
  - no reactions or private chats across a block;
  - reaction RLS hides blocked users' reactions.
- **coach-web vitest:** MessageItem quote, badges and actions; ChatPanel paste-to-stage, reply bar and tabs; clipboard helpers.
- **iOS Swift Testing:** `copyText` per message kind, quote preview text, reaction grouping and counts, thread-switcher labels.
- **Manual:** simulator plus coach-web against the local stack — all four features, both directions, plus push routing to a private chat on a device.

## Open decisions (recommendations in bold)

1. **Who can start a private chat?** **Both the athlete and the coach.**
2. **Does a removed coach keep read access to their old private chat?** **No.** Access ends with the coaching link; the athlete keeps the history.
3. **Push notifications for reactions?** **Not in v1.**
4. **Where do shared run cards go?** **Always the team chat.**
5. **Release timing:** **1.1, after 1.0 approval.** It's merged to `dev` behind no flag; the next TestFlight build picks it up.
