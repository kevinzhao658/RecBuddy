-- Tapback reactions: 👍 like · ‼️ emphasize · ❓ question · 😂 laugh · 🎉 congrats.
-- One per person per message; set_reaction() toggles. Visible to everyone who
-- can read the message, except reactions from people the reader blocked.
-- Un-reacting sets kind = null (an UPDATE) rather than deleting: realtime
-- filters UPDATE events through RLS but not DELETE events.

create table message_reactions (
  message_id  uuid not null references messages(id) on delete cascade,
  user_id     uuid not null references profiles(id) on delete cascade,
  thread_id   uuid not null references message_threads(id) on delete cascade, -- for realtime filtering
  kind        text check (kind in ('like', 'emphasize', 'question', 'laugh', 'congrats')), -- null = removed
  created_at  timestamptz not null default now(),
  primary key (message_id, user_id)
);
create index on message_reactions (thread_id);
alter table message_reactions enable row level security;

-- Readable when the reacted-to message is (messages RLS applies the joined-at
-- cutoff and author blocks), and the reactor isn't someone the reader blocked.
create policy reactions_read on message_reactions for select
  using (not has_blocked(auth.uid(), user_id)
         and exists (select 1 from messages m where m.id = message_reactions.message_id));
-- No write policies: set_reaction() is the only writer.

create trigger block_suspended_writes before insert or update or delete on message_reactions
  for each row execute function block_suspended_writes();

alter publication supabase_realtime add table message_reactions;

create or replace function set_reaction(p_message uuid, p_kind text) returns text
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  m messages%rowtype;
  v_existing text;
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

  select kind into v_existing from message_reactions where message_id = p_message and user_id = auth.uid();
  if v_existing = p_kind then
    update message_reactions set kind = null where message_id = p_message and user_id = auth.uid();
    return null;
  end if;
  insert into message_reactions (message_id, user_id, thread_id, kind)
  values (p_message, auth.uid(), m.thread_id, p_kind)
  on conflict (message_id, user_id) do update set kind = excluded.kind, created_at = now();
  return p_kind;
end;
$$;
revoke all on function set_reaction(uuid, text) from public, anon;
grant execute on function set_reaction(uuid, text) to authenticated;
