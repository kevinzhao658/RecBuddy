-- Quote-replies: a message can point at the message it answers.
-- on delete set null: deleting the original leaves the reply, showing
-- "Original message unavailable".
alter table messages add column if not exists reply_to_id uuid references messages(id) on delete set null;
create index if not exists messages_reply_to_id_idx on messages (reply_to_id) where reply_to_id is not null;

-- A reply must quote a message in the SAME thread (no quoting across
-- conversations). Definer: the check must see the target even if RLS hides it.
create or replace function messages_reply_same_thread() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from messages where id = new.reply_to_id and thread_id = new.thread_id
  ) then
    raise exception 'a reply must quote a message in the same thread';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_reply_same_thread on messages;
create trigger messages_reply_same_thread before insert or update of reply_to_id, thread_id on messages
  for each row execute function messages_reply_same_thread();
