-- Kevin (2026-10-21): the athlete and their current coaches can name their
-- team chat too, like any group. Chats still require an active member.
create or replace function rename_conversation(p_thread uuid, p_title text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_title text := nullif(trim(p_title), '');
  v_kind text;
begin
  select kind into v_kind from message_threads where id = p_thread;
  if v_kind = 'team' then
    if not can_post_thread(p_thread) then raise exception 'conversation not found'; end if;
  else
    perform assert_active_member(p_thread);
  end if;
  if v_title is not null and contains_blocked_term(v_title) then
    raise exception 'that name includes language that isn''t allowed';
  end if;
  update message_threads set title = v_title where id = p_thread;
end;
$$;
revoke all on function rename_conversation(uuid, text) from public, anon;
grant execute on function rename_conversation(uuid, text) to authenticated;
