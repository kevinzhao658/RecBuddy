-- iMessage-style conversations, part 3: membership follows the coaching
-- relationship and blocks.
--   Coach removed from an athlete's team:
--     - their 1:1 with the athlete becomes read-only for both
--     - they are taken out of every group that includes the athlete
--   Coach re-linked: a 1:1 left read-only by the removal becomes active again.
--   Block: the blocked person loses their 1:1 with the blocker entirely, and
--   the blocker keeps it read-only. (In shared groups the blocker simply stops
--   seeing their messages; that's the messages_read has_blocked filter.)

-- 1:1 chats (exactly two member rows, any status) between two people.
create or replace function one_to_one_threads(p_a uuid, p_b uuid) returns setof uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select t.id from message_threads t
  where t.kind = 'chat'
    and exists (select 1 from thread_members where thread_id = t.id and user_id = p_a)
    and exists (select 1 from thread_members where thread_id = t.id and user_id = p_b)
    and (select count(*) from thread_members where thread_id = t.id) = 2;
$$;
revoke all on function one_to_one_threads(uuid, uuid) from public, anon, authenticated;

create or replace function conversations_on_coach_unlink() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  update message_threads set read_only = true
  where id in (select one_to_one_threads(old.coach_id, old.athlete_id));
  update thread_members set status = 'readonly'
  where thread_id in (select one_to_one_threads(old.coach_id, old.athlete_id)) and status = 'active';

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
drop trigger if exists conversations_on_coach_unlink on coach_athlete;
create trigger conversations_on_coach_unlink after delete on coach_athlete
  for each row execute function conversations_on_coach_unlink();

create or replace function conversations_on_coach_link() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_thread uuid;
begin
  for v_thread in select one_to_one_threads(new.coach_id, new.athlete_id) loop
    -- Only a 1:1 that the removal made read-only (both members readonly);
    -- a block leaves one member 'removed' and stays closed.
    if (select count(*) from thread_members where thread_id = v_thread and status = 'readonly') = 2 then
      update thread_members set status = 'active' where thread_id = v_thread;
      update message_threads set read_only = false where id = v_thread;
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists conversations_on_coach_link on coach_athlete;
create trigger conversations_on_coach_link after insert on coach_athlete
  for each row execute function conversations_on_coach_link();

-- block_user: unchanged behavior from 20261018120000, plus the 1:1 rule.
create or replace function block_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception 'you can''t block yourself'; end if;
  if not exists (select 1 from profiles where id = p_user_id) then raise exception 'user not found'; end if;

  insert into user_blocks (blocker_id, blocked_id) values (auth.uid(), p_user_id)
  on conflict do nothing;

  -- Sever the coaching link in both directions (fires conversations_on_coach_unlink).
  delete from coach_athlete
  where (athlete_id = auth.uid() and coach_id = p_user_id)
     or (athlete_id = p_user_id and coach_id = auth.uid());

  -- Their 1:1 with me: gone for them, read-only for me.
  update message_threads set read_only = true
  where id in (select one_to_one_threads(auth.uid(), p_user_id));
  update thread_members set status = 'removed'
  where user_id = p_user_id and thread_id in (select one_to_one_threads(auth.uid(), p_user_id));
end;
$$;
