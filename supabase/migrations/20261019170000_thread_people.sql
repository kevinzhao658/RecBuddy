-- Display info for everyone who can appear as a sender in a thread the caller
-- can read: chat members of any status (a member who left keeps their name on
-- old messages) or, for a team thread, the athlete plus their coaches. Group
-- members aren't always readable through profiles RLS (another coach's
-- athlete), so the chat UIs resolve names here.
create or replace function thread_people(p_thread uuid)
returns table (user_id uuid, name text, initials text, avatar_url text, title text)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.name, p.initials, p.avatar_url, p.title::text
  from message_threads t
  join profiles p on p.id in (
    select m.user_id from thread_members m where m.thread_id = t.id
    union select t.athlete_id
    union select ca.coach_id from coach_athlete ca where t.kind = 'team' and ca.athlete_id = t.athlete_id
  )
  where t.id = p_thread and can_read_thread(p_thread)
  order by p.name;
$$;
revoke all on function thread_people(uuid) from public, anon;
grant execute on function thread_people(uuid) to authenticated;

-- Inboxes refresh live when someone starts a chat with you or adds you.
alter publication supabase_realtime add table thread_members;
