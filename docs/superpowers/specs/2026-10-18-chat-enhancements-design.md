# Chat enhancements: design

**Revised:** 2026-10-19 · **Branch:** `feat/chat-enhancements` (worktree `../RecBuddy-chat`), rebased on `dev` after report/block and the admin console merged
**Surfaces:** athlete iOS, coach web, supabase, legal docs · **Ships in:** 1.1, after 1.0 is approved

## Intent

RecBuddy chat today is a single team thread per athlete. Kevin wants it to work like iMessage, so athletes and coaches can react to messages, reply to a specific message, copy and paste freely, and start 1:1 or group conversations with the people they train with. Coaches should be able to coordinate with each other and message groups of athletes, and athletes should be able to talk to their coaches individually or reach other athletes who share a coach.

## Status

| Feature | State |
|---|---|
| Copy and paste | Built and verified on iOS and coach web (`dfd45f5`) |
| Replies, plus "Message coach/athlete about this" | Built and verified (`dfd45f5`, immutability fix `afdc4f0`) |
| Reactions | Designed below |
| Conversations (1:1 and group) | Designed below |

## Goals

- Five fixed reactions on any message, with counts and who reacted, plus a push to the message's author.
- iMessage-style conversations, where any set of eligible people can share a 1:1 or group chat alongside each athlete's existing team chat.
- A Messages inbox on both apps and a "New message → To:" compose screen with search.
- Moderation (report, block, language filter, admin console) keeps working across every conversation type.

## Non-goals

- Free-form emoji reactions, message editing or unsending, typing indicators, read receipts per person, muting, and attachments other than photos.
- Push notifications on coach web (coaches have no device tokens today).

## Anti-goals

- Anyone seeing a conversation they are not a member of, including that it exists.
- A blocked person regaining any way to reach or read the person who blocked them.
- Athletes being findable by other athletes after they turn that off.

## Decisions (Kevin's)

**Reactions**
- The set is 👍 like, ‼️ emphasize, ❓ question, 😂 laugh, 🎉 congratulate, one reaction per person per message. Tapping your current reaction removes it.
- Everyone in the conversation sees counts and who reacted.
- The message's author gets a push, e.g. "Dani 👍 your message".
- iOS shows an iMessage corner badge on the bubble's top corner, and the long-press menu gets the five emoji as a row above Reply, Copy, Report and Block.
- Coach web shows Slack-style chips under the message. Used reactions stay visible, the full row of five appears while hovering the message, clicking a chip toggles your reaction, and hovering a chip lists who reacted.

**Conversations**
- The Chat tab on iOS becomes an inbox list like the Messages app, with the athlete's team chat pinned first and a ✎ compose button.
- Coach web gets a Messages page in the sidebar with the conversation list on the left and the open chat on the right. An athlete's "Message" button opens their team chat there.
- Compose is "New message → To:" with search. One person makes a 1:1 and two or more make a group. If a conversation with exactly those members already exists, it opens instead of creating a duplicate.
- **Who can be added (search scope):**
  - A coach can add coaches who share an athlete with them, plus their own athletes, and a group can include several athletes.
  - An athlete can add their own coaches, plus any athlete who shares a coach with them, unless that athlete has turned off discoverability.
- **Discoverability** is a Settings switch, "Let my coach's other athletes find me", on by default. Turning it off hides the athlete from other athletes' search, while their coaches can still add them.
- Any member can add people (within the scope that applies to them) and rename a group. New members see history from the moment they join.
- Any member can leave a group. The team chat can't be left, and a 1:1 can only be hidden from your own list.
- Conversations are invisible to non-members, so other coaches don't know a private conversation exists.
- **When a coach is removed from an athlete's team:**
  - A 1:1 between them becomes read-only for both.
  - The coach is taken out of every group that includes that athlete, and the group continues for everyone else.
- **Blocking** cuts the blocked person's access completely. Their 1:1 with the blocker becomes unreadable to them and read-only for the blocker, and they can't add the blocker to anything new. In a shared group the blocker no longer sees their messages, and they stay a member.
- Coaches can start conversations with other coaches (coach-to-coach), as part of the same compose flow.

## Design

### Data model

The existing tables stay, extended so one access check covers both thread types.

- **`message_threads`**
  - Gains `kind text not null default 'team' check (kind in ('team','chat'))`, plus `title text`, `created_by uuid` and `read_only boolean not null default false`.
  - `athlete_id` and `coach_id` become nullable. A check constraint keeps both required for `team` and both null for `chat`.
  - The old `unique (athlete_id, coach_id)` becomes a partial unique index, one team thread per athlete.
- **`thread_members`** (`thread_id, user_id, status, joined_at, last_read_at, hidden_at`) holds membership for `chat` threads.
  - `status` is `active`, `readonly` (removed-coach 1:1s), `left`, or `removed` (blocked, or a coach taken out of an athlete's group).
  - Members with `active` or `readonly` can read, and only `active` members of a non-read-only thread can post.
  - Reads are limited to messages created after `joined_at`.
- **`message_reactions`** (`message_id, user_id, thread_id, kind, created_at`, primary key `(message_id, user_id)`). `thread_id` is filled by trigger so realtime can filter by thread.
- **`profiles.discoverable_to_athletes boolean not null default true`.**

### Access functions

- **`can_read_thread(thread_id)`** replaces `can_access_thread` as the single gate.
  - For `team` it applies today's rule: the athlete always, and team coaches while they aren't blocked by the athlete.
  - For `chat` it checks membership status and `joined_at`.
- **`can_post_thread(thread_id)`** adds the active and not-read-only checks.
- These policies are rewritten on top of the two functions:
  - `messages` read, send and mark-read;
  - `message_threads`;
  - `thread_members`;
  - `message_reactions`;
  - the `chat-images` storage policies;
  - `report_content`.

  The admin console's `admin_report_context` already works by thread id and needs no change.
- **`can_add_to_chat(adder, target)`** implements the search scope above, rejecting blocks in either direction and suspended accounts.

### RPCs (all security definer, signed-in only)

| RPC | Purpose |
|---|---|
| `search_chat_people(q)` | Returns people in the caller's scope with a context line ("Your athlete", "Coaches Maya with you", "Shares Dani with you") |
| `start_conversation(user_ids, title)` | Validates scope and returns an existing thread with the identical active member set, or creates one |
| `add_conversation_members` | Adds members to an existing conversation |
| `rename_conversation` | Sets the group name |
| `leave_conversation` | Leaves a group |
| `hide_conversation` | Hides a 1:1 from your own list |
| `mark_thread_read(thread_id)` | Sets `last_read_at` for chats; keeps the existing per-message `read` flag for team threads |
| `my_conversations()` | Feeds both inboxes |

`my_conversations()` returns each thread with:
- kind, title, member names and avatars;
- the last message preview and time;
- the unread count, read-only flag, and the team chat's athlete.

`unread_message_counts()` keeps working for the coach roster badges and counts only threads the caller can read.

### Lifecycle triggers

- **`coach_athlete` delete**
  - A 1:1 chat between that coach and athlete gets `read_only = true`, and both memberships go to `readonly`.
  - The coach's membership in any group containing that athlete goes to `removed`.
- **`block_user`** extends the existing function.
  - The blocked person's membership in their 1:1 with the blocker goes to `removed` and the thread becomes read-only.
  - `can_add_to_chat` rejects any future add between them.

### Push

`notify-message` keeps the team-chat behavior and sends `chat` messages to every member with an active status except the sender. Only iOS users have tokens, so in practice this reaches athletes. The alert title is the group name or the sender, and `thread_id` routes a tap to that conversation.

Reactions get a separate path. A database webhook on `message_reactions` insert calls a small `notify-reaction` function, which pushes "Name 👍 your message" to the author when the author isn't the reactor and hasn't blocked them.

### iOS

- **ChatsView** (new Chat tab root) lists `my_conversations()` with the team chat pinned, unread dots, search, and a ✎ compose button.
- **ChatView** becomes thread-generic. `ChatStore.open(threadId:)` replaces the athlete-scoped open, and the team chat keeps its share-to-chat entry points.
- **NewMessageView** has the To: field with pills, results grouped into Coaches and Athletes, and a note shown when two or more athletes are selected.
- **ConversationInfoView** lists members, lets you rename, add people or leave, and shows the read-only banner.
- **Reactions** get the corner badge, the palette in the context menu, and a who-reacted sheet.
- **Settings** gets the discoverability switch on the account screen.
- **Routing:** `AppRouter` gains `openThreadId` from the push payload, and the report and block name fallbacks change from "this coach" to the sender's name for any member.

### Coach web

- **A `/coach/messages` route** holds the list and thread panes, plus a sidebar "Messages" item with the unread total. The existing athlete "Message" button navigates there with the team thread selected.
- **Compose** is a To: field with the same search grouping.
- **Conversation info** shows members, rename, add people, leave, and the read-only banner.
- **Reactions** show as Slack chips (used chips always, all five on hover, tooltip with names).
- **Report and block parity:** "Report message" and "Block" in the message action bar, plus a Blocked list in coach settings with Unblock. This is needed now because coaches can be in conversations with any athlete.

### Legal (CLAUDE.md gate, same PR, all three copies plus dates)

- **Privacy Policy, Communications:** add reactions, conversations and group chats.
- **Privacy Policy, How your information is shared:**
  - members of a conversation see each other's names, photos and messages;
  - athletes who share a coach can find each other by name unless they turn that off;
  - conversations are visible only to their members.
- **Privacy Policy, Your choices:** add the discoverability switch, leaving a group, and blocking.
- **Terms, Your Content:** covers messages and reactions in group conversations.
- **App Store privacy label:** no change, since these remain Other User Content and Name, which are already declared.

### Data migration

- Every existing thread becomes `kind = 'team'`.
- Before writing the migration, a read-only check on dev and prod counts athletes with more than one thread. Any extras convert to `chat` threads, with the athlete and that thread's coach as active members, so no history is lost and nothing leaks to other coaches.

### Testing

- **supabase/tests:** `reactions.test.ts`, plus `conversations.test.ts` covering:
  - each search-scope rule and the discoverability switch;
  - exact-member-set reuse;
  - non-member invisibility;
  - the 1:1 read-only and group removal rules on coach removal;
  - blocking inside 1:1s and groups;
  - leave, rename and add;
  - `joined_at` history cutoff;
  - storage policies;
  - `report_content` on a chat message;
  - unread counts.
- **Coach web vitest:** messages page, compose, info, reaction chips, and the report and block actions.
- **iOS Swift Testing:** reaction summarizing, inbox ordering and labels, and compose selection rules.
- **Manual:** the simulator plus coach web against the local stack. That covers every flow above, with a push check on a device for chat messages and reactions.

## Calls made while writing this (Claude's, not Kevin's)

1. **Re-linking a removed coach** - If a removed coach is linked to the athlete again, their read-only 1:1 becomes active again. They aren't put back into groups automatically.
2. **Relationships that end elsewhere** - Coach-to-coach and athlete-to-athlete conversations don't change when the people involved stop sharing an athlete or a coach. Only the coach-removal and block rules above change membership.
3. **Third parties and blocks** - A third member may add someone to a group that contains a person they blocked or were blocked by, the way iMessage allows. The blocker simply doesn't see the blocked person's messages there.
4. **Group size** - Groups are capped at 25 members.
5. **Duplicate check** - The "exact member set" check ignores the group name.
6. **Group names** - Names go through the existing language filter.
7. **Suspended accounts** - The admin console's write block for suspended accounts extends to `thread_members` and `message_reactions`.
8. **Leaving history** - A member who leaves or is removed loses access to the conversation's history. Read-only history applies only to removed-coach 1:1s, per Kevin's decision.

## Left to the builder

The exact visual polish within the chosen layouts, the copy for empty states and banners, index choices, and splitting the work into commits.
