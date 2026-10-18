-- User-generated content safety (App Store guideline 1.2):
--   1. Block   — a user blocks another user. Blocking severs any coach link
--                both ways, stops re-linking, and hides the blocked user's
--                messages from the blocker. The blocked user loses access to
--                the blocker's chat thread.
--   2. Report  — a user reports a message (or a user). A snapshot of the
--                message is kept as evidence, so it survives deletion.
--   3. Filter  — messages containing a blocked term are rejected on insert/update.
-- Everything is enforced here, so the iOS and web apps share the same rules.

-- ============================================================
-- 1. Blocks
-- ============================================================
create table user_blocks (
  blocker_id  uuid not null references profiles(id) on delete cascade,
  blocked_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index on user_blocks (blocked_id);
alter table user_blocks enable row level security;

-- Read + unblock your own blocks. Inserts go through block_user() so the
-- coach link is always severed in the same transaction.
create policy blocks_read on user_blocks for select using (blocker_id = auth.uid());
create policy blocks_delete on user_blocks for delete using (blocker_id = auth.uid());

-- Definer so policies can check blocks without exposing other users' rows.
-- Answers only for pairs that include the caller — nobody can probe whether
-- two other users blocked each other.
create or replace function has_blocked(_blocker uuid, _blocked uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select auth.uid() in (_blocker, _blocked)
     and exists (select 1 from user_blocks where blocker_id = _blocker and blocked_id = _blocked);
$$;

create or replace function block_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception 'you can''t block yourself'; end if;
  if not exists (select 1 from profiles where id = p_user_id) then raise exception 'user not found'; end if;

  insert into user_blocks (blocker_id, blocked_id) values (auth.uid(), p_user_id)
  on conflict do nothing;

  -- Sever the coaching link in both directions.
  delete from coach_athlete
  where (athlete_id = auth.uid() and coach_id = p_user_id)
     or (athlete_id = p_user_id and coach_id = auth.uid());
end;
$$;

-- Blocked users with display info (the blocker can no longer read their
-- profile through team RLS once the link is gone).
create or replace function get_blocked_users()
returns table (user_id uuid, name text, initials text, avatar_url text, blocked_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select b.blocked_id, p.name, p.initials, p.avatar_url, b.created_at
  from user_blocks b join profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

-- No path (invite, coach_add_athlete, admin insert) may re-link a blocked pair.
create or replace function coach_athlete_block_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from user_blocks
             where (blocker_id = new.athlete_id and blocked_id = new.coach_id)
                or (blocker_id = new.coach_id and blocked_id = new.athlete_id)) then
    raise exception 'this connection is blocked';
  end if;
  return new;
end;
$$;
create trigger coach_athlete_block_guard before insert or update on coach_athlete
  for each row execute function coach_athlete_block_guard();

-- Thread access, now block-aware. The athlete always has access to their own
-- thread; the thread's coach and the athlete's team only while not blocked by
-- the athlete. (is_coach_of is already false once the link is severed; the
-- explicit check covers the thread's original coach_id.)
create or replace function can_access_thread(_athlete uuid, _coach uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select _athlete = auth.uid()
      or ((_coach = auth.uid() or is_coach_of(_athlete)) and not has_blocked(_athlete, auth.uid()));
$$;

drop policy threads_read on message_threads;
drop policy threads_write on message_threads;
create policy threads_read on message_threads for select
  using (can_access_thread(athlete_id, coach_id));
create policy threads_write on message_threads for all
  using (can_access_thread(athlete_id, coach_id))
  with check (can_access_thread(athlete_id, coach_id));

drop policy messages_read on messages;
drop policy messages_send on messages;
drop policy messages_update on messages;
-- Readers never see messages from someone they blocked.
create policy messages_read on messages for select
  using (
    not has_blocked(auth.uid(), messages.from_user_id)
    and exists (
      select 1 from message_threads t
      where t.id = messages.thread_id and can_access_thread(t.athlete_id, t.coach_id)
    )
  );
create policy messages_send on messages for insert
  with check (
    from_user_id = auth.uid()
    and exists (
      select 1 from message_threads t
      where t.id = thread_id and can_access_thread(t.athlete_id, t.coach_id)
    )
  );
create policy messages_update on messages for update
  using (exists (
    select 1 from message_threads t
    where t.id = messages.thread_id and can_access_thread(t.athlete_id, t.coach_id)
  ));

drop policy if exists "chat_images_select" on storage.objects;
drop policy if exists "chat_images_insert" on storage.objects;
create policy "chat_images_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.message_threads t
      where t.id::text = (storage.foldername(name))[1]
        and public.can_access_thread(t.athlete_id, t.coach_id)
    )
  );
create policy "chat_images_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and exists (
      select 1 from public.message_threads t
      where t.id::text = (storage.foldername(name))[1]
        and public.can_access_thread(t.athlete_id, t.coach_id)
    )
  );

-- ============================================================
-- 2. Reports
-- ============================================================
create table content_reports (
  id                uuid primary key default gen_random_uuid(),
  -- set null (not cascade) so a report survives either account's deletion
  reporter_id       uuid references profiles(id) on delete set null,
  reported_user_id  uuid references profiles(id) on delete set null,
  message_id        uuid references messages(id) on delete set null,
  reason            text not null check (reason in ('harassment', 'hate', 'sexual', 'violence', 'spam', 'other')),
  details           text check (char_length(details) <= 1000),
  content_snapshot  jsonb,       -- copy of the reported message at report time
  status            text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);
create index on content_reports (status, created_at);
alter table content_reports enable row level security;
-- Reporters can see their own reports; inserts go through report_content().
-- Moderation (status updates) happens with the service role.
create policy reports_read_own on content_reports for select using (reporter_id = auth.uid());

create or replace function report_content(
  p_reason text,
  p_message_id uuid default null,
  p_reported_user_id uuid default null,
  p_details text default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  m messages%rowtype;
  t message_threads%rowtype;
  v_user uuid := p_reported_user_id;
  v_snapshot jsonb;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_reason not in ('harassment', 'hate', 'sexual', 'violence', 'spam', 'other') then
    raise exception 'invalid reason';
  end if;
  if (select count(*) from content_reports
      where reporter_id = auth.uid() and created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many reports today — email support@recbuddy.app';
  end if;

  if p_message_id is not null then
    select * into m from messages where id = p_message_id;
    if not found then raise exception 'message not found'; end if;
    select * into t from message_threads where id = m.thread_id;
    if not can_access_thread(t.athlete_id, t.coach_id) then raise exception 'message not found'; end if;
    v_user := m.from_user_id;
    v_snapshot := jsonb_build_object(
      'kind', m.kind, 'body', m.body, 'payload', m.payload,
      'thread_id', m.thread_id, 'sent_at', m.created_at);
  else
    if v_user is null then raise exception 'nothing to report'; end if;
    -- Only someone you are (or were, before blocking) connected to.
    if not (exists (select 1 from coach_athlete
                    where (athlete_id = auth.uid() and coach_id = v_user)
                       or (athlete_id = v_user and coach_id = auth.uid()))
            or has_blocked(auth.uid(), v_user)) then
      raise exception 'user not found';
    end if;
  end if;
  if v_user = auth.uid() then raise exception 'you can''t report yourself'; end if;

  insert into content_reports (reporter_id, reported_user_id, message_id, reason, details, content_snapshot)
  values (auth.uid(), v_user, p_message_id, p_reason, nullif(trim(p_details), ''), v_snapshot)
  returning id into v_id;
  return v_id;
end;
$$;

-- ============================================================
-- 3. Objectionable-language filter
-- ============================================================
-- Severe slurs and self-harm harassment only — ordinary profanity is allowed
-- ("that hill was damn hard"). Extend with: insert into blocked_terms values ('...').
-- Matched case-insensitively on word boundaries.
create table blocked_terms (term text primary key);
alter table blocked_terms enable row level security; -- no policies: definer-only

insert into blocked_terms (term) values
  ('nigger'), ('niggers'), ('nigga'), ('niggas'),
  ('faggot'), ('faggots'), ('fag'), ('fags'),
  ('retard'), ('retards'), ('tranny'), ('trannies'),
  ('chink'), ('chinks'), ('spic'), ('spics'), ('kike'), ('kikes'),
  ('wetback'), ('wetbacks'), ('coon'), ('coons'),
  ('kill yourself'), ('kys');

create or replace function contains_blocked_term(_text text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(_text, '') <> '' and exists (
    select 1 from blocked_terms
    where lower(_text) ~ ('\m' || regexp_replace(term, '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '\M')
  );
$$;

create or replace function messages_language_filter() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if contains_blocked_term(new.body)
     or contains_blocked_term(new.payload->>'note')
     or contains_blocked_term(new.payload->>'reason') then
    raise exception 'message contains language that isn''t allowed';
  end if;
  return new;
end;
$$;
create trigger messages_language_filter before insert or update of body, payload on messages
  for each row execute function messages_language_filter();

-- ============================================================
-- Grants: RPCs for signed-in users only
-- ============================================================
revoke all on function block_user(uuid) from public, anon;
grant execute on function block_user(uuid) to authenticated;
revoke all on function get_blocked_users() from public, anon;
grant execute on function get_blocked_users() to authenticated;
revoke all on function report_content(text, uuid, uuid, text) from public, anon;
grant execute on function report_content(text, uuid, uuid, text) to authenticated;
revoke all on function has_blocked(uuid, uuid) from public, anon;
grant execute on function has_blocked(uuid, uuid) to authenticated;
revoke all on function can_access_thread(uuid, uuid) from public, anon;
grant execute on function can_access_thread(uuid, uuid) to authenticated;
revoke all on function contains_blocked_term(text) from public, anon;
