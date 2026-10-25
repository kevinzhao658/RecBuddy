-- thread_people also names people who left or were removed (so old messages
-- keep their sender), which made the iOS People list show them as members.
-- `current` says who is in the conversation now: active/read-only chat
-- members, or a team thread's athlete and current coaches.
drop function if exists thread_people(uuid);
create function thread_people(p_thread uuid)
returns table (user_id uuid, name text, initials text, avatar_url text, title text, current boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.name, p.initials, p.avatar_url, p.title::text,
    case t.kind
      when 'team' then true
      else exists (select 1 from thread_members m
                   where m.thread_id = t.id and m.user_id = p.id and m.status in ('active', 'readonly'))
    end
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
