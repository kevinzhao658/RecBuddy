-- Unblocking puts back what the block took away. A block severs the coaching
-- link, removes the blocked person from shared chats, and makes the 1:1
-- read-only; unblocking used to delete only the block row, so a coach vanished
-- from the team and their chat stayed closed. block_user now keeps a snapshot
-- of exactly what it changes, and unblock_user restores it.

alter table user_blocks add column restore jsonb;

-- block_user: unchanged behavior from 20261019250000, plus the snapshot. A
-- repeat block keeps the first snapshot (on conflict do nothing).
create or replace function block_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_restore jsonb;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;
  if p_user_id is null or p_user_id = auth.uid() then raise exception 'you can''t block yourself'; end if;
  if not exists (select 1 from profiles where id = p_user_id) then raise exception 'user not found'; end if;

  v_restore := jsonb_build_object(
    'links', coalesce((
      select jsonb_agg(jsonb_build_object('coach_id', coach_id, 'athlete_id', athlete_id,
                                          'relationship', relationship, 'permission', permission))
      from coach_athlete
      where (athlete_id = auth.uid() and coach_id = p_user_id)
         or (athlete_id = p_user_id and coach_id = auth.uid())), '[]'::jsonb),
    'threads', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'read_only', read_only))
      from message_threads where id in (select one_to_one_threads(auth.uid(), p_user_id))), '[]'::jsonb),
    -- The blocked person's place in every chat we share, and my place in our 1:1s.
    'members', coalesce((
      select jsonb_agg(jsonb_build_object('thread_id', m.thread_id, 'user_id', m.user_id, 'status', m.status))
      from thread_members m join message_threads t on t.id = m.thread_id
      where t.kind = 'chat'
        and ((m.user_id = p_user_id
              and exists (select 1 from thread_members x where x.thread_id = t.id and x.user_id = auth.uid()))
          or (m.user_id = auth.uid()
              and t.id in (select one_to_one_threads(auth.uid(), p_user_id))))), '[]'::jsonb));

  insert into user_blocks (blocker_id, blocked_id, restore) values (auth.uid(), p_user_id, v_restore)
  on conflict do nothing;

  -- Sever the coaching link in both directions (fires conversations_on_coach_unlink;
  -- a blocking coach keeps their groups).
  perform set_config('recbuddy.blocking_coach', auth.uid()::text, true);
  delete from coach_athlete
  where (athlete_id = auth.uid() and coach_id = p_user_id)
     or (athlete_id = p_user_id and coach_id = auth.uid());
  perform set_config('recbuddy.blocking_coach', '', true);

  -- Their 1:1 with me: gone for them, read-only for me.
  update message_threads set read_only = true
  where id in (select one_to_one_threads(auth.uid(), p_user_id));
  update thread_members set status = 'removed'
  where user_id = p_user_id and thread_id in (select one_to_one_threads(auth.uid(), p_user_id));
end;
$$;

-- Lift my block on someone and restore the snapshot. While they still block me,
-- only my side is lifted. A head coach comes back as an assistant when the
-- athlete has taken on another head coach since. Chat rows are restored only
-- where the block left them (readonly/removed), so a chat someone has since
-- left stays left.
create or replace function unblock_user(p_user_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp
as $$
declare v_restore jsonb; v_link jsonb; v_role team_role;
begin
  if auth.uid() is null then raise exception 'not signed in'; end if;

  delete from user_blocks where blocker_id = auth.uid() and blocked_id = p_user_id
  returning restore into v_restore;
  if v_restore is null then return; end if; -- not blocked, or blocked before snapshots existed
  if exists (select 1 from user_blocks where blocker_id = p_user_id and blocked_id = auth.uid()) then
    return;
  end if;

  for v_link in select * from jsonb_array_elements(v_restore->'links') loop
    v_role := (v_link->>'relationship')::team_role;
    if v_role = 'head' and exists (select 1 from coach_athlete
                                   where athlete_id = (v_link->>'athlete_id')::uuid and relationship = 'head') then
      v_role := 'assistant';
    end if;
    insert into coach_athlete (coach_id, athlete_id, relationship, permission)
    values ((v_link->>'coach_id')::uuid, (v_link->>'athlete_id')::uuid, v_role,
            (v_link->>'permission')::coach_permission)
    on conflict (coach_id, athlete_id) do nothing;
  end loop;

  update thread_members m set status = x->>'status'
  from jsonb_array_elements(v_restore->'members') x
  where m.thread_id = (x->>'thread_id')::uuid and m.user_id = (x->>'user_id')::uuid
    and m.status in ('readonly', 'removed');

  update message_threads t set read_only = (x->>'read_only')::boolean
  from jsonb_array_elements(v_restore->'threads') x
  where t.id = (x->>'id')::uuid;
end;
$$;
revoke all on function unblock_user(uuid) from public, anon;
grant execute on function unblock_user(uuid) to authenticated;
