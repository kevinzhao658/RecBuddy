-- Kevin (2026-10-21): a person can add several reaction kinds to one message,
-- at most one of each (e.g. 😂 and ❓). One row per (message, person, kind);
-- set_reaction() toggles that kind only. Un-reacting sets active = false (an
-- UPDATE, which realtime filters through RLS) instead of deleting the row.

delete from message_reactions where kind is null;   -- removed reactions carry nothing to keep
alter table message_reactions add column active boolean not null default true;
alter table message_reactions alter column kind set not null;
alter table message_reactions drop constraint message_reactions_pkey;
alter table message_reactions add primary key (message_id, user_id, kind);

create or replace function set_reaction(p_message uuid, p_kind text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  m messages%rowtype;
  v_active boolean;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_kind not in ('like', 'emphasize', 'question', 'laugh', 'congrats') then
    raise exception 'invalid reaction';
  end if;
  select * into m from messages where id = p_message;
  if not found or not can_read_message(m.thread_id, m.created_at) or not can_post_thread(m.thread_id) then
    raise exception 'message not found';
  end if;
  if has_blocked(auth.uid(), m.from_user_id) or has_blocked(m.from_user_id, auth.uid()) then
    raise exception 'message not found';
  end if;

  select active into v_active from message_reactions
  where message_id = p_message and user_id = auth.uid() and kind = p_kind;
  if v_active then
    update message_reactions set active = false
    where message_id = p_message and user_id = auth.uid() and kind = p_kind;
    return null;
  end if;
  -- First time: INSERT (the push webhook fires on INSERT only). Re-adding a
  -- kind I removed is an UPDATE, so toggling never re-notifies the author.
  insert into message_reactions (message_id, user_id, thread_id, kind)
  values (p_message, auth.uid(), m.thread_id, p_kind)
  on conflict (message_id, user_id, kind) do update set active = true, created_at = now();
  return p_kind;
end;
$$;
revoke all on function set_reaction(uuid, text) from public, anon;
grant execute on function set_reaction(uuid, text) to authenticated;
