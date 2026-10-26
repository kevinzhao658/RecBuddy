-- Kevin (2026-10-21): two people with a block between them (either
-- direction) can't be put in the same new group by anyone. Groups that
-- already hold both when the block happens keep them (the blocker just stops
-- seeing the other's messages). The error stays generic.
create or replace function chat_pairs_blocked(p_new uuid[], p_with uuid[]) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  -- Reads user_blocks directly: has_blocked() only answers for pairs that
  -- include the caller. Not granted to clients, so nobody can probe pairs.
  select exists (
    select 1 from user_blocks b
    where (b.blocker_id = any(p_new) and b.blocked_id = any(p_with))
       or (b.blocked_id = any(p_new) and b.blocker_id = any(p_with)));
$$;
revoke all on function chat_pairs_blocked(uuid[], uuid[]) from public, anon, authenticated;

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

  -- A 1:1 (exactly two member rows ever, named or not) stays a 1:1; adding
  -- people starts a new group. A group that shrank to two still grows in place.
  if (select count(*) from thread_members where thread_id = p_thread) = 2 then
    return start_conversation(array(select x from unnest(v_active) x where x <> v_me) || v_new, null);
  end if;

  if cardinality(v_active) + cardinality(v_new) > 25 then raise exception 'groups are limited to 25 people'; end if;
  foreach v_target in array v_new loop
    -- 'removed' is final (coach taken off the athlete's team, or blocked).
    if not can_add_to_chat(v_me, v_target)
       or exists (select 1 from thread_members where thread_id = p_thread and user_id = v_target and status = 'removed') then
      raise exception 'you can''t add that person to a chat';
    end if;
  end loop;
  if chat_pairs_blocked(v_new, v_active || v_new) then
    raise exception 'you can''t add that person to a chat';
  end if;
  insert into thread_members (thread_id, user_id, status, joined_at)
  select p_thread, x, 'active', now() from unnest(v_new) x
  on conflict (thread_id, user_id) do update
    set status = 'active', joined_at = now(), hidden_at = null, last_read_at = null;
  return p_thread;
end;
$$;
