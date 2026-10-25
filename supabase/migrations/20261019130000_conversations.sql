-- iMessage-style conversations, part 1: schema + a single access gate.
--
-- message_threads now has two kinds:
--   team  the existing per-athlete thread (athlete + their whole coaching team)
--   chat  a 1:1 or group conversation whose members live in thread_members
-- Every policy that used can_access_thread(athlete, coach) now goes through
-- can_read_thread(thread) / can_post_thread(thread), which handle both kinds.

-- ============================================================
-- 1. Threads gain a kind
-- ============================================================
alter table message_threads add column if not exists kind text not null default 'team'
  check (kind in ('team', 'chat'));
alter table message_threads add column if not exists title text;
alter table message_threads add column if not exists created_by uuid references profiles(id) on delete set null;
alter table message_threads add column if not exists read_only boolean not null default false;
alter table message_threads alter column athlete_id drop not null;
alter table message_threads alter column coach_id drop not null;

-- ============================================================
-- 2. Members of chat threads
-- ============================================================
create table thread_members (
  thread_id     uuid not null references message_threads(id) on delete cascade,
  user_id       uuid not null references profiles(id) on delete cascade,
  status        text not null default 'active' check (status in ('active', 'readonly', 'left', 'removed')),
  joined_at     timestamptz not null default now(),
  last_read_at  timestamptz,
  hidden_at     timestamptz,
  primary key (thread_id, user_id)
);
create index on thread_members (user_id);
alter table thread_members enable row level security;

-- One team thread per athlete (replaces unique (athlete_id, coach_id)). Any
-- athlete with several threads keeps the least recently updated as team; the others become
-- chats between that athlete and that thread's coach, so no history is lost
-- and nothing becomes visible to other coaches. (Dev and prod had none on
-- 2026-10-21; this only matters for local/test data.)
with ranked as (
  select id, athlete_id, coach_id,
         row_number() over (partition by athlete_id order by updated_at, id) as rn
  from message_threads where kind = 'team'
)
insert into thread_members (thread_id, user_id, status, joined_at)
select r.id, u.user_id, 'active', '-infinity'::timestamptz
from ranked r cross join lateral (values (r.athlete_id), (r.coach_id)) as u(user_id)
where r.rn > 1
on conflict do nothing;

update message_threads t set kind = 'chat', athlete_id = null, coach_id = null
where t.kind = 'team' and exists (select 1 from thread_members m where m.thread_id = t.id);

alter table message_threads drop constraint if exists message_threads_athlete_id_coach_id_key;
create unique index message_threads_one_team_per_athlete on message_threads (athlete_id) where kind = 'team';
alter table message_threads add constraint message_threads_kind_shape check (
  (kind = 'team' and athlete_id is not null and coach_id is not null)
  or (kind = 'chat' and athlete_id is null and coach_id is null)
);

-- Athletes control whether athletes who share a coach can find them.
alter table profiles add column if not exists discoverable_to_athletes boolean not null default true;

-- ============================================================
-- 3. The access gate
-- ============================================================
-- Team threads: the athlete, or a coach CURRENTLY on their team and not
-- blocked by them. (Previously the thread's original coach_id kept access
-- forever, so a removed co-coach who opened the chat first could keep
-- reading and posting.) _coach is kept for signature compatibility.
create or replace function can_access_thread(_athlete uuid, _coach uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select _athlete = auth.uid()
      or (is_coach_of(_athlete) and not has_blocked(_athlete, auth.uid()));
$$;

create or replace function can_read_thread(p_thread uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select case t.kind
      when 'team' then can_access_thread(t.athlete_id, t.coach_id)
      else exists (select 1 from thread_members m
                   where m.thread_id = t.id and m.user_id = auth.uid()
                     and m.status in ('active', 'readonly'))
    end
    from message_threads t where t.id = p_thread
  ), false);
$$;

create or replace function can_post_thread(p_thread uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((
    select not t.read_only and case t.kind
      when 'team' then can_access_thread(t.athlete_id, t.coach_id)
      else exists (select 1 from thread_members m
                   where m.thread_id = t.id and m.user_id = auth.uid() and m.status = 'active')
    end
    from message_threads t where t.id = p_thread
  ), false);
$$;

-- A chat member sees only messages sent after they joined.
create or replace function can_read_message(p_thread uuid, p_at timestamptz) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select can_read_thread(p_thread)
     and not exists (select 1 from thread_members m
                     where m.thread_id = p_thread and m.user_id = auth.uid() and m.joined_at > p_at);
$$;

-- ============================================================
-- 4. Policies rebuilt on the gate
-- ============================================================
create policy thread_members_read on thread_members for select using (can_read_thread(thread_id));
-- No insert/update/delete policies: membership changes go through RPCs.

drop policy if exists threads_read on message_threads;
drop policy if exists threads_write on message_threads;
-- Team rows are checked from their own columns (not by re-reading the table),
-- so INSERT ... RETURNING works for a team thread created in the same request.
create policy threads_read on message_threads for select
  using (case kind when 'team' then can_access_thread(athlete_id, coach_id) else can_read_thread(id) end);
-- Clients may still create a TEAM thread (the shipped 1.0 app finds-or-inserts
-- one), but only naming a coach actually linked to the athlete, by the athlete
-- or a coach on their team. Otherwise any coach could claim an athlete's single
-- team slot with themselves as coach and read the athlete's chat. New clients
-- call team_thread_id(). Chat threads are created only by start_conversation(),
-- and no client may update or delete a thread (bump_thread runs as definer).
create policy threads_insert on message_threads for insert
  with check (
    kind = 'team' and not read_only and title is null and created_by is null
    and exists (select 1 from coach_athlete ca where ca.athlete_id = message_threads.athlete_id
                                                and ca.coach_id = message_threads.coach_id)
    and (athlete_id = auth.uid() or is_coach_of(athlete_id))
    and not has_blocked(athlete_id, auth.uid())
  );

drop policy if exists messages_read on messages;
drop policy if exists messages_send on messages;
drop policy if exists messages_update on messages;
create policy messages_read on messages for select
  using (not has_blocked(auth.uid(), messages.from_user_id) and can_read_message(thread_id, created_at));
create policy messages_send on messages for insert
  with check (from_user_id = auth.uid() and can_post_thread(thread_id));
create policy messages_update on messages for update
  using (can_read_thread(thread_id));

drop policy if exists "chat_images_select" on storage.objects;
drop policy if exists "chat_images_insert" on storage.objects;
-- A photo is readable when the caller can read a message that carries it:
-- this applies the joined-at cutoff and blocks, not just thread membership.
-- The uploader can always read their own file (needed between upload and send).
create index if not exists messages_image_path_idx on messages ((payload->>'path')) where kind = 'image';
create policy "chat_images_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'chat-images'
    and (owner = auth.uid()
         or exists (select 1 from public.messages m
                    where m.kind = 'image' and m.payload->>'path' = storage.objects.name
                      and m.thread_id::text = (storage.foldername(storage.objects.name))[1]
                      and not public.has_blocked(auth.uid(), m.from_user_id)
                      and public.can_read_message(m.thread_id, m.created_at)))
  );
create policy "chat_images_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'chat-images'
    and not exists (select 1 from public.profiles where id = auth.uid() and suspended_at is not null)
    and exists (select 1 from public.message_threads t
                where t.id::text = (storage.foldername(name))[1] and public.can_post_thread(t.id))
  );

-- Bumping updated_at must work for chat threads too (members have no update
-- policy on chat threads), so the trigger runs with definer rights.
create or replace function bump_thread() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin update message_threads set updated_at = now() where id = new.thread_id; return new; end;
$$;

-- ============================================================
-- 5. Reports go through the gate too
-- ============================================================
create or replace function report_content(
  p_reason text,
  p_message_id uuid default null,
  p_reported_user_id uuid default null,
  p_details text default null
) returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  m messages%rowtype;
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
    if not found or not can_read_message(m.thread_id, m.created_at) then
      raise exception 'message not found';
    end if;
    v_user := m.from_user_id;
    v_snapshot := jsonb_build_object(
      'kind', m.kind, 'body', m.body, 'payload', m.payload,
      'thread_id', m.thread_id, 'sent_at', m.created_at);
  else
    if v_user is null then raise exception 'nothing to report'; end if;
    -- Someone you are (or were, before blocking) connected to, or share a conversation with.
    if not (exists (select 1 from coach_athlete
                    where (athlete_id = auth.uid() and coach_id = v_user)
                       or (athlete_id = v_user and coach_id = auth.uid()))
            or exists (select 1 from thread_members a join thread_members b using (thread_id)
                       where a.user_id = auth.uid() and b.user_id = v_user)
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
-- 6. Team thread lookup (replaces client-side find-or-insert)
-- ============================================================
create or replace function team_thread_id(p_athlete uuid) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_head uuid;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if not (p_athlete = auth.uid() or (is_coach_of(p_athlete) and not has_blocked(p_athlete, auth.uid()))) then
    raise exception 'not allowed';
  end if;
  select id into v_id from message_threads where kind = 'team' and athlete_id = p_athlete;
  if v_id is not null then return v_id; end if;
  -- Head coach if there is one, else any coach still on the team.
  select coach_id into v_head from coach_athlete where athlete_id = p_athlete
  order by (relationship = 'head') desc, created_at limit 1;
  if v_head is null then raise exception 'no coach linked yet'; end if;
  insert into message_threads (kind, athlete_id, coach_id) values ('team', p_athlete, v_head)
  on conflict (athlete_id) where kind = 'team' do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from message_threads where kind = 'team' and athlete_id = p_athlete;
  end if;
  return v_id;
end;
$$;

-- Suspended accounts can't change memberships either.
create trigger block_suspended_writes before insert or update or delete on thread_members
  for each row execute function block_suspended_writes();

-- ============================================================
-- Grants
-- ============================================================
revoke all on function can_read_thread(uuid) from public, anon;
grant execute on function can_read_thread(uuid) to authenticated;
revoke all on function can_post_thread(uuid) from public, anon;
grant execute on function can_post_thread(uuid) to authenticated;
revoke all on function can_read_message(uuid, timestamptz) from public, anon;
grant execute on function can_read_message(uuid, timestamptz) to authenticated;
revoke all on function team_thread_id(uuid) from public, anon;
grant execute on function team_thread_id(uuid) to authenticated;
