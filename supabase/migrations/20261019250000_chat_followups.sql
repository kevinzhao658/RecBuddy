-- Chat follow-ups (Kevin, 2026-10-24).
--   1. A coach who blocks their athlete stays in groups with that athlete (the
--      spec's "blocker stays a member"; messages_read already hides the
--      blocked person's messages). An athlete blocking their coach still takes
--      the coach out of the athlete's groups, as before.
--   2. Co-members can't read each other's last_read_at / hidden_at. Clients
--      read only their own membership rows; member lists come from
--      thread_people / my_conversations.
--   3. Inbox, roster unread, and start_conversation's "same people" lookup
--      start from the caller's own threads instead of scanning every thread.
--   4. Housekeeping: drop the unused assert_chat_name; pin search_path.
--   5. A chat with no messages stays out of the inbox until someone posts.

-- ── 1 ────────────────────────────────────────────────────────────────────
create or replace function conversations_on_coach_unlink() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.coach_id = old.athlete_id then return old; end if; -- self-coaching link
  update message_threads set read_only = true
  where id in (select one_to_one_threads(old.coach_id, old.athlete_id));
  update thread_members set status = 'readonly'
  where thread_id in (select one_to_one_threads(old.coach_id, old.athlete_id)) and status = 'active';

  -- The coach blocking this athlete keeps their groups (set by block_user).
  if coalesce(current_setting('recbuddy.blocking_coach', true), '') = old.coach_id::text then
    return old;
  end if;
  update thread_members m set status = 'removed'
  where m.user_id = old.coach_id and m.status in ('active', 'readonly')
    and m.thread_id in (select t.id from message_threads t
                        where t.kind = 'chat'
                          and (select count(*) from thread_members where thread_id = t.id) > 2
                          and exists (select 1 from thread_members x
                                      where x.thread_id = t.id and x.user_id = old.athlete_id));
  return old;
end;
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

  -- Sever the coaching link in both directions (fires conversations_on_coach_unlink;
  -- a blocking coach keeps their groups).
  perform set_config('recbuddy.blocking_coach', auth.uid()::text, true);
  delete from coach_athlete
  where (athlete_id = auth.uid() and coach_id = p_user_id)
     or (athlete_id = p_user_id and coach_id = auth.uid());
  perform set_config('recbuddy.blocking_coach', '', true);

  -- Their 1:1 with me: gone for them, read-only for me.
  update message_threads set read_only = true
  where id in (select one_to_one_threads(auth.uid(), p_user_id));
  update thread_members set status = 'removed'
  where user_id = p_user_id and thread_id in (select one_to_one_threads(auth.uid(), p_user_id));
end;
$$;

-- ── 2 ────────────────────────────────────────────────────────────────────
drop policy if exists thread_members_read on thread_members;
create policy thread_members_read on thread_members for select using (user_id = auth.uid());

-- ── 3 + 5 ────────────────────────────────────────────────────────────────
-- Team threads the caller can see (same rule as can_access_thread, but
-- starting from the caller's own links instead of every team thread).
create or replace function my_team_threads() returns setof message_threads
language sql stable security definer set search_path = public, pg_temp as $$
  select t.* from message_threads t
  where t.kind = 'team'
    and (t.athlete_id = auth.uid() or t.coach_id = auth.uid()
         or t.athlete_id in (select athlete_id from coach_athlete where coach_id = auth.uid()))
    and can_access_thread(t.athlete_id, t.coach_id);
$$;
revoke all on function my_team_threads() from public, anon, authenticated;

create index if not exists messages_unread_idx on messages (thread_id) where read = false;

create or replace function inbox_rows()
returns table (thread_id uuid, kind text, title text, team_athlete_id uuid, members jsonb,
               last_body text, last_kind text, last_from uuid, last_at timestamptz,
               unread int, read_only boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  with mine as (
    select t.id, t.kind, t.title, t.athlete_id, t.read_only, null::timestamptz as joined, null::timestamptz as read_at
    from my_team_threads() t
    union all
    -- chats I'm in and haven't hidden, once someone has posted
    select t.id, t.kind, t.title, null, t.read_only, m.joined_at, m.last_read_at
    from thread_members m join message_threads t on t.id = m.thread_id
    where m.user_id = auth.uid() and t.kind = 'chat' and m.status in ('active', 'readonly') and m.hidden_at is null
      and exists (select 1 from messages x where x.thread_id = t.id)
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
    case mine.kind
      when 'team' then (select count(*)::int from messages v
                        where v.thread_id = mine.id and v.read = false and v.from_user_id <> auth.uid()
                          and not has_blocked(auth.uid(), v.from_user_id))
      else (select count(*)::int from messages v
            where v.thread_id = mine.id and v.created_at > coalesce(mine.read_at, mine.joined)
              and v.from_user_id <> auth.uid() and not has_blocked(auth.uid(), v.from_user_id))
    end,
    mine.read_only
  from mine
  left join lateral (select v.body, v.kind, v.from_user_id, v.created_at from messages v
                     where v.thread_id = mine.id
                       and (mine.joined is null or v.created_at >= mine.joined)
                       and not has_blocked(auth.uid(), v.from_user_id)
                     order by v.created_at desc limit 1) last on true
  order by (mine.kind = 'team' and mine.athlete_id = auth.uid()) desc, last.created_at desc nulls last;
$$;
revoke all on function inbox_rows() from public, anon, authenticated;

create or replace function unread_message_counts()
returns table (athlete_id uuid, unread int)
language sql stable security definer set search_path = public, pg_temp as $$
  select t.athlete_id, count(*)::int
  from my_team_threads() t join messages m on m.thread_id = t.id
  where m.read = false and m.from_user_id <> auth.uid()
    and not has_blocked(auth.uid(), m.from_user_id)
  group by t.athlete_id;
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
  if chat_pairs_blocked(v_ids || v_me, v_ids || v_me) then
    raise exception 'you can''t add that person to a chat';
  end if;

  -- Same people already talking? Open that chat instead (and unhide it for me).
  -- Candidates are only chats I'm active in and that have exactly as many
  -- active members.
  select array_agg(x order by x) into v_set from unnest(v_ids || v_me) x;
  select t.id into v_id
  from thread_members mm join message_threads t on t.id = mm.thread_id
  where mm.user_id = v_me and mm.status = 'active'
    and t.kind = 'chat' and not t.read_only
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

-- ── 4 ────────────────────────────────────────────────────────────────────
drop function if exists assert_chat_name(text);
alter function coach_athlete_fixed_pair() set search_path = public, pg_temp;
