-- Unread message counts per athlete for the signed-in coach (roster + Message
-- button badges). `read` is a single per-message flag (MVP), so "unread" =
-- not sent by me and not yet marked read by anyone in the thread. Covers
-- assistant coaches via is_coach_of.
create or replace function unread_message_counts()
returns table (athlete_id uuid, unread int)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.athlete_id, count(*)::int as unread
  from messages m
  join message_threads t on t.id = m.thread_id
  where (t.coach_id = auth.uid() or is_coach_of(t.athlete_id))
    and m.from_user_id <> auth.uid()
    and m.read = false
  group by t.athlete_id;
$$;

revoke all on function unread_message_counts() from public;
revoke execute on function unread_message_counts() from anon;
grant execute on function unread_message_counts() to authenticated;
