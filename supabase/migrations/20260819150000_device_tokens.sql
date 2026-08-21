-- Push notification device tokens (athlete iPhones). One row per device;
-- env records which APNs host this token belongs to (Xcode-installed builds
-- get sandbox tokens regardless of build config). RLS: owner-only — the
-- notify-message Edge Function reads with the service role.

create table device_tokens (
  user_id    uuid not null references profiles(id) on delete cascade,
  token      text not null,
  env        text not null default 'prod' check (env in ('sandbox', 'prod')),
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

alter table device_tokens enable row level security;

create policy device_tokens_own on device_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
