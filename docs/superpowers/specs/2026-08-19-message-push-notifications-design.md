# Message Push Notifications (Athlete) — Design

**Date:** 2026-08-19
**Status:** Approved design, pending implementation plan
**Surfaces:** athlete-iOS (registration, inline reply, settings), supabase (one migration + one Edge Function + dashboard webhook)

## Purpose

When a coach messages an athlete, the athlete gets a push notification on their
iPhone — including with the app closed — and can reply inline from the
notification. Athlete-only in v1 (coach web push is a separate later feature).

## Decisions (settled during brainstorming)

| Question | Decision |
|---|---|
| Direction | **Athlete only** — coach→athlete pushes; athlete→coach stays unread-badges in coach-web |
| Triggers | **Everything the coach sends** — text, image, workout card, adjust card, each with a fitting preview |
| Inline reply | **Yes** — `UNTextInputNotificationAction`; reply inserts a normal `text` message |
| Enable/disable | **Settings toggle** ("Message notifications"); OFF deletes this device's token row — server-side off, not client muting |
| Webhook config | **Supabase dashboard** (dev + prod), NOT a migration — project-URL triggers aren't portable, and prod config stays dashboard-side (SMTP precedent) |
| Badge counts / coach web push / notification images | Out of scope v1 |

## Pipeline

```
coach inserts into messages
  → Database Webhook (dashboard: INSERT on public.messages) with secret header
  → Edge Function notify-message
      1. verify webhook secret (reject otherwise)
      2. load thread (athlete_id, coach_id); if from_user_id == athlete_id → exit (no athlete→coach push)
      3. build preview from kind (pure function; see table)
      4. SELECT tokens from device_tokens where user_id = athlete_id
      5. APNs HTTP/2 POST per token — host by token.env (sandbox|prod);
         ES256 JWT from APNS_P8/APNS_KEY_ID/APNS_TEAM_ID secrets, cached ≤50 min
      6. 410 / BadDeviceToken responses → DELETE that token row
```

### Preview table (kind → notification)

| kind | title | body |
|---|---|---|
| text | coach name | message body (truncated ~120 chars) |
| image | coach name | "Sent a photo" |
| workout | coach name | "Shared a workout: {payload.title}" |
| adjust | coach name | "Adjusted your plan: {payload.from} → {payload.to}" |

Payload extras: `thread_id`, `message_id`, category `COACH_MESSAGE`,
`apns thread-id` = thread_id (stacks per conversation).

## Data (one migration)

```sql
create table device_tokens (
  user_id    uuid not null references profiles(id) on delete cascade,
  token      text not null,
  env        text not null default 'prod' check (env in ('sandbox','prod')),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);
alter table device_tokens enable row level security;
create policy device_tokens_own on device_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
```

The Edge Function reads tokens with the service-role client (functions are
server-side; RLS protects client access only).

## iOS

- **`PushRegistrar`** + `@UIApplicationDelegateAdaptor(AppDelegate.self)` on
  `RecBuddyApp`: after permission, `registerForRemoteNotifications()`; the
  token callback upserts `(user_id, token, env)` — env `sandbox` under
  `#if DEBUG`, else `prod`. `aps-environment` entitlement added in `project.yml`.
- **Category** `COACH_MESSAGE` with `UNTextInputNotificationAction`
  ("Reply", placeholder "Message your coach…"). The delegate's reply handler
  runs in a background task and inserts a `text` message into the payload's
  thread via the persisted Supabase session; on failure it posts a local
  "Couldn't send — open RecBuddy" notification (never silently drops the reply).
- **Tap routing:** payload `thread_id` → app opens on the Chat tab (extends the
  existing `recbuddy://` handling).
- **Foreground suppression:** `willPresent` returns no banner while the chat
  screen is visible (realtime already paints it); banner elsewhere in the app.
- **Settings:** new "Notifications" section in athlete Settings with a
  "Message notifications" toggle. ON → permission (if needed) + register +
  upsert. OFF → delete this device's row. Sign-out also deletes the row.

## Edge cases

- Multi-device: one row per device; each managed independently.
- Athlete switch on one device: upsert under the new user_id; prior athlete's
  row deleted at their sign-out.
- Stale tokens: self-cleaned via APNs responses.
- Offline reply: background send fails → local failure notification.
- Coach messages while athlete's chat is open: realtime renders it; no banner.

## Testing

- Preview builder = pure TS function in the Edge Function module (logic tabled
  above; no Deno test rig in CI — kept small and reviewable).
- iOS: registration/reply glue is thin; anything pure (payload parsing, env
  pick) unit-tested in `RecBuddyTests`.
- End-to-end (sandbox APNs, inline reply, tap routing) is device testing with a
  Debug build — same gate as HealthKit device verification.

## Prerequisites (user-provided, one-time)

1. **APNs Auth Key**: developer portal → Certificates, Identifiers & Profiles →
   Keys → ＋ → enable "Apple Push Notifications service" → download `.p8`
   (note the Key ID). One key serves sandbox AND production APNs.
2. **Secrets** on BOTH Supabase projects (CLI `supabase secrets set` or
   dashboard): `APNS_P8` (file contents), `APNS_KEY_ID`, `APNS_TEAM_ID`
   (= R2D2PYP37U), `APNS_TOPIC` (= app.recbuddy.athlete), `WEBHOOK_SECRET`
   (any random string).
3. **Database Webhook** in each project's dashboard: table `messages`, event
   INSERT, type HTTP request → POST to the project's
   `/functions/v1/notify-message`, header `x-webhook-secret: <WEBHOOK_SECRET>`.

## Out of scope (v1)

Coach/web push; app-icon badge counts; rich notification images; per-thread
mute; quiet hours.
