-- Kevin (2026-10-25): any member of a group chat can remove someone, like
-- iMessage. Removing works like that person leaving ('left', not the final
-- 'removed' used for coach unlinks and blocks), so anyone in the group can add
-- them back later; they then see only messages from when they rejoin.
-- Team chats follow coaching links, and a conversation between two people has
-- nobody to remove, so neither allows it.
create or replace function remove_conversation_member(p_thread uuid, p_user uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  t message_threads;
begin
  if (select kind from message_threads where id = p_thread) = 'team' then
    raise exception 'team chat members follow the coaching team';
  end if;
  t := assert_active_member(p_thread);
  if t.read_only then raise exception 'this conversation is read-only'; end if;
  if p_user = auth.uid() then raise exception 'use leave to take yourself out'; end if;
  if (select count(*) from thread_members where thread_id = p_thread and status = 'active') < 3 then
    raise exception 'a conversation between two people has nobody to remove';
  end if;
  update thread_members set status = 'left'
  where thread_id = p_thread and user_id = p_user and status in ('active', 'readonly');
  if not found then raise exception 'that person isn''t in this conversation'; end if;
end;
$$;
revoke all on function remove_conversation_member(uuid, uuid) from public, anon;
grant execute on function remove_conversation_member(uuid, uuid) to authenticated;
