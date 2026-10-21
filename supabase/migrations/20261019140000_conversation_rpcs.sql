-- iMessage-style conversations, part 2: who you can reach, starting and
-- editing chats, and the inbox. All RPCs are security definer and act as
-- auth.uid(); membership rows are never written by clients directly.

-- ============================================================
-- 0. Coaching links are the basis of reach, so only agreed links count
-- ============================================================
-- team_write let an athlete INSERT a link to any coach without an invite. That
-- used to expose only the athlete's own data; with chat reach it would let an
-- athlete message any coach and find that coach's other athletes. Athletes now
-- join coaches only through redeem_invite (definer). Admin coaches still add
-- co-coaches, and athletes can still remove or change their own links.
drop policy if exists team_write on coach_athlete;
create policy team_insert on coach_athlete for insert
  with check (coach_can_admin(athlete_id));
create policy team_update on coach_athlete for update
  using (athlete_id = auth.uid() or coach_can_admin(athlete_id))
  with check (athlete_id = auth.uid() or coach_can_admin(athlete_id));
create policy team_delete on coach_athlete for delete
  using (athlete_id = auth.uid() or coach_can_admin(athlete_id));

-- ============================================================
-- 1. Reach: the people a user may start a chat with or add to one
-- ============================================================
-- One row per reachable person, best context first:
--   rank 1  Your coach / Your athlete          (direct coaching link)
--   rank 2  Coaches <athlete> with you          (coach sharing one of my athletes)
--   rank 3  Shares <coach> with you             (athlete sharing one of my coaches,
--                                                only if they're discoverable)
-- Blocks in either direction, suspended accounts and the user themself are excluded.
create or replace function chat_reach(p_user uuid)
returns table (user_id uuid, person_kind text, context text, rank int)
language sql stable security definer set search_path = public, pg_temp as $$
  with cand as (
    -- my coaches
    select ca.coach_id as uid, 'coach' as kind, 'Your coach' as ctx, 1 as rk
    from coach_athlete ca where ca.athlete_id = p_user
    union all
    -- my athletes
    select ca.athlete_id, 'athlete', 'Your athlete', 1
    from coach_athlete ca where ca.coach_id = p_user
    union all
    -- coaches sharing one of my athletes
    select other.coach_id, 'coach', 'Coaches ' || split_part(a.name, ' ', 1) || ' with you', 2
    from coach_athlete mine
    join coach_athlete other on other.athlete_id = mine.athlete_id and other.coach_id <> p_user
    join profiles a on a.id = mine.athlete_id
    where mine.coach_id = p_user
    union all
    -- athletes sharing one of my coaches (discoverable only)
    select other.athlete_id, 'athlete', 'Shares ' || split_part(c.name, ' ', 1) || ' with you', 3
    from coach_athlete mine
    join coach_athlete other on other.coach_id = mine.coach_id and other.athlete_id <> p_user
    join profiles c on c.id = mine.coach_id
    join profiles t on t.id = other.athlete_id and t.discoverable_to_athletes
    where mine.athlete_id = p_user
  )
  select distinct on (cand.uid) cand.uid, cand.kind, cand.ctx, cand.rk
  from cand
  join profiles p on p.id = cand.uid
  where cand.uid <> p_user
    and p.suspended_at is null
    and not exists (select 1 from user_blocks b
                    where (b.blocker_id = p_user and b.blocked_id = cand.uid)
                       or (b.blocker_id = cand.uid and b.blocked_id = p_user))
  order by cand.uid, cand.rk, cand.ctx;
$$;
revoke all on function chat_reach(uuid) from public, anon, authenticated;

create or replace function can_add_to_chat(p_adder uuid, p_target uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from chat_reach(p_adder) r where r.user_id = p_target);
$$;
revoke all on function can_add_to_chat(uuid, uuid) from public, anon, authenticated;

create or replace function search_chat_people(p_query text default '')
returns table (user_id uuid, name text, initials text, avatar_url text, person_kind text, context text)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.user_id, p.name, p.initials, p.avatar_url, r.person_kind, r.context
  from chat_reach(auth.uid()) r
  join profiles p on p.id = r.user_id
  where coalesce(trim(p_query), '') = ''
     or p.name ilike '%' || replace(replace(replace(trim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%'
  order by (r.person_kind = 'coach') desc, p.name
  limit 20;
$$;

-- ============================================================
-- 2. Starting and editing chats
-- ============================================================
create or replace function assert_chat_name(p_title text) returns text
language plpgsql immutable as $$
begin
  return nullif(trim(p_title), '');
end;
$$;

create or replace function start_conversation(p_user_ids uuid[], p_title text default null)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_me uuid := auth.uid();
  v_ids uuid[];
  v_set uuid[];
  v_title text := nullif(trim(p_title), '');
  v_id uuid;
  v_target uuid;
begin
  if v_me is null then raise exception 'not signed in'; end if;
  select coalesce(array_agg(distinct x), '{}') into v_ids from unnest(p_user_ids) x where x <> v_me;
  if cardinality(v_ids) = 0 then raise exception 'pick at least one person'; end if;
  if cardinality(v_ids) + 1 > 25 then raise exception 'groups are limited to 25 people'; end if;
  if v_title is not null and contains_blocked_term(v_title) then
    raise exception 'that name includes language that isn''t allowed';
  end if;
  foreach v_target in array v_ids loop
    if not can_add_to_chat(v_me, v_target) then
      raise exception 'you can''t add that person to a chat';
    end if;
  end loop;

  -- Same people already talking? Open that chat instead (and unhide it for me).
  select array_agg(x order by x) into v_set from unnest(v_ids || v_me) x;
  select t.id into v_id
  from message_threads t
  where t.kind = 'chat' and not t.read_only
    and (select array_agg(m.user_id order by m.user_id) from thread_members m
         where m.thread_id = t.id and m.status = 'active') = v_set
  order by t.updated_at, t.id limit 1;
  if v_id is not null then
    update thread_members set hidden_at = null where thread_id = v_id and user_id = v_me;
    return v_id;
  end if;

  insert into message_threads (kind, title, created_by) values ('chat', v_title, v_me) returning id into v_id;
  insert into thread_members (thread_id, user_id, status) select v_id, x, 'active' from unnest(v_set) x;
  return v_id;
end;
$$;

-- Active member of a postable chat, or raise.
create or replace function assert_active_member(p_thread uuid) returns message_threads
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare t message_threads;
begin
  select * into t from message_threads where id = p_thread;
  if not found or t.kind <> 'chat' or not exists (
       select 1 from thread_members where thread_id = p_thread and user_id = auth.uid() and status = 'active') then
    raise exception 'conversation not found';
  end if;
  return t;
end;
$$;
revoke all on function assert_active_member(uuid) from public, anon, authenticated;

-- Returns the thread to open: the same one for a group, or a NEW group when
-- adding people to a 1:1 (the 1:1 stays as it was, like iMessage).
create or replace function add_conversation_members(p_thread uuid, p_user_ids uuid[])
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t message_threads;
  v_me uuid := auth.uid();
  v_new uuid[];
  v_target uuid;
  v_active uuid[];
begin
  t := assert_active_member(p_thread);
  if t.read_only then raise exception 'this conversation is read-only'; end if;
  select array_agg(user_id) into v_active from thread_members where thread_id = p_thread and status = 'active';
  select coalesce(array_agg(distinct x), '{}') into v_new from unnest(p_user_ids) x where not (x = any(v_active));
  if cardinality(v_new) = 0 then return p_thread; end if;

  if cardinality(v_active) = 2 and t.title is null then
    return start_conversation(array(select x from unnest(v_active) x where x <> v_me) || v_new, null);
  end if;

  if cardinality(v_active) + cardinality(v_new) > 25 then raise exception 'groups are limited to 25 people'; end if;
  foreach v_target in array v_new loop
    if not can_add_to_chat(v_me, v_target) then
      raise exception 'you can''t add that person to a chat';
    end if;
  end loop;
  insert into thread_members (thread_id, user_id, status, joined_at)
  select p_thread, x, 'active', now() from unnest(v_new) x
  on conflict (thread_id, user_id) do update
    set status = 'active', joined_at = now(), hidden_at = null, last_read_at = null;
  return p_thread;
end;
$$;

create or replace function rename_conversation(p_thread uuid, p_title text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_title text := nullif(trim(p_title), '');
begin
  perform assert_active_member(p_thread);
  if v_title is not null and contains_blocked_term(v_title) then
    raise exception 'that name includes language that isn''t allowed';
  end if;
  update message_threads set title = v_title where id = p_thread;
end;
$$;

create or replace function leave_conversation(p_thread uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform assert_active_member(p_thread);
  if (select count(*) from thread_members where thread_id = p_thread and status = 'active') <= 2 then
    raise exception 'use hide for a 1:1 conversation';
  end if;
  update thread_members set status = 'left' where thread_id = p_thread and user_id = auth.uid();
end;
$$;

create or replace function hide_conversation(p_thread uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update thread_members set hidden_at = now()
  where thread_id = p_thread and user_id = auth.uid() and status in ('active', 'readonly');
  if not found then raise exception 'conversation not found'; end if;
end;
$$;

-- A new message brings a hidden chat back for everyone.
create or replace function unhide_on_message() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update thread_members set hidden_at = null where thread_id = new.thread_id and hidden_at is not null;
  return new;
end;
$$;
drop trigger if exists messages_unhide on messages;
create trigger messages_unhide after insert on messages
  for each row execute function unhide_on_message();

create or replace function mark_thread_read(p_thread uuid) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_kind text;
begin
  if not can_read_thread(p_thread) then raise exception 'conversation not found'; end if;
  select kind into v_kind from message_threads where id = p_thread;
  if v_kind = 'chat' then
    update thread_members set last_read_at = now() where thread_id = p_thread and user_id = auth.uid();
  else
    update messages set read = true
    where thread_id = p_thread and read = false and from_user_id <> auth.uid();
  end if;
end;
$$;

-- ============================================================
-- 3. The inbox
-- ============================================================
create or replace function my_conversations()
returns table (thread_id uuid, kind text, title text, team_athlete_id uuid, members jsonb,
               last_body text, last_kind text, last_from uuid, last_at timestamptz,
               unread int, read_only boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  with mine as (
    -- team threads I can read
    select t.id, t.kind, t.title, t.athlete_id, t.read_only, null::timestamptz as joined, null::timestamptz as read_at
    from message_threads t
    where t.kind = 'team' and can_access_thread(t.athlete_id, t.coach_id)
    union all
    -- chats I'm in and haven't hidden
    select t.id, t.kind, t.title, null, t.read_only, m.joined_at, m.last_read_at
    from message_threads t join thread_members m on m.thread_id = t.id
    where t.kind = 'chat' and m.user_id = auth.uid() and m.status in ('active', 'readonly') and m.hidden_at is null
  ),
  visible as (
    select msg.* from messages msg join mine on mine.id = msg.thread_id
    where not has_blocked(auth.uid(), msg.from_user_id)
      and (mine.joined is null or msg.created_at >= mine.joined)
  )
  select mine.id, mine.kind, mine.title, mine.athlete_id,
    coalesce((
      select jsonb_agg(jsonb_build_object('user_id', p.id, 'name', p.name, 'initials', p.initials,
                                          'avatar_url', p.avatar_url) order by p.name)
      from profiles p
      where p.id <> auth.uid() and (
        (mine.kind = 'team' and (p.id = mine.athlete_id
           or p.id in (select coach_id from coach_athlete where athlete_id = mine.athlete_id)))
        or (mine.kind = 'chat' and p.id in (select user_id from thread_members
                                             where thread_id = mine.id and status in ('active', 'readonly'))))
    ), '[]'::jsonb),
    last.body, last.kind::text, last.from_user_id, last.created_at,
    (select count(*)::int from visible v
     where v.thread_id = mine.id and v.from_user_id <> auth.uid()
       and case mine.kind when 'team' then not v.read
                          else v.created_at > coalesce(mine.read_at, mine.joined) end),
    mine.read_only
  from mine
  left join lateral (select v.body, v.kind, v.from_user_id, v.created_at from visible v
                     where v.thread_id = mine.id order by v.created_at desc limit 1) last on true
  order by (mine.kind = 'team' and mine.athlete_id = auth.uid()) desc, last.created_at desc nulls last;
$$;

-- Roster badges: unread in each athlete's TEAM thread only (chats have their
-- own unread in my_conversations).
create or replace function unread_message_counts()
returns table (athlete_id uuid, unread int)
language sql stable security definer set search_path = public, pg_temp as $$
  select t.athlete_id, count(*)::int
  from messages m join message_threads t on t.id = m.thread_id
  where t.kind = 'team' and can_access_thread(t.athlete_id, t.coach_id)
    and m.from_user_id <> auth.uid() and m.read = false
    and not has_blocked(auth.uid(), m.from_user_id)
  group by t.athlete_id;
$$;

-- ============================================================
-- Grants
-- ============================================================
do $$
declare f text;
begin
  foreach f in array array[
    'search_chat_people(text)', 'start_conversation(uuid[], text)', 'add_conversation_members(uuid, uuid[])',
    'rename_conversation(uuid, text)', 'leave_conversation(uuid)', 'hide_conversation(uuid)',
    'mark_thread_read(uuid)', 'my_conversations()', 'unread_message_counts()'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
