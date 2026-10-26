-- Kevin (2026-10-21): "Add people" works from a team chat too. It starts a
-- new group with the team plus the added people (like adding to a 1:1).
create or replace function add_conversation_members(p_thread uuid, p_user_ids uuid[])
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t message_threads;
  v_me uuid := auth.uid();
  v_new uuid[];
  v_target uuid;
  v_active uuid[];
begin
  -- Team chat: the athlete and their current coaches, derived from coach
  -- links. Adding people starts a new group with the team in it, so the team
  -- chat (and the athlete's workout cards in it) stays private to the team.
  if (select kind from message_threads where id = p_thread) = 'team' then
    if not can_post_thread(p_thread) then raise exception 'conversation not found'; end if;
    select array_agg(x) into v_active from (
      select athlete_id x from message_threads where id = p_thread
      union select ca.coach_id from coach_athlete ca join message_threads tt on ca.athlete_id = tt.athlete_id
        where tt.id = p_thread) s
      where x <> v_me;
    return start_conversation(v_active || p_user_ids, null);
  end if;

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
revoke all on function add_conversation_members(uuid, uuid[]) from public, anon;
grant execute on function add_conversation_members(uuid, uuid[]) to authenticated;
