-- Coaching links need the added person's consent (Kevin, 2026-10-24).
-- A link opens the athlete's training data and, since conversations, chat
-- reach. Before this, an admin coach could link ANY coach to their athlete and
-- any coach could link ANY athlete to themselves ("add existing athlete"),
-- neither side asked. Now both create a request, and the link exists only once
-- the person being added accepts. redeem_invite is unchanged: the coach made
-- the invite and the athlete redeemed it, so both agreed.

create table if not exists link_requests (
  id           uuid primary key default gen_random_uuid(),
  coach_id     uuid not null references profiles(id) on delete cascade,
  athlete_id   uuid not null references profiles(id) on delete cascade,
  relationship team_role not null,
  requested_by uuid not null references profiles(id) on delete cascade,
  approver_id  uuid not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  unique (coach_id, athlete_id),
  check (approver_id in (coach_id, athlete_id))
);
alter table link_requests enable row level security;
-- Clients read through the RPCs below; no direct access.
revoke all on link_requests from anon, authenticated;

-- No client writes a coaching link directly any more.
drop policy if exists team_insert on coach_athlete;

-- The permission a new link gets: head -> admin, others -> edit.
-- Blocked in either direction (has_blocked only answers for the caller's own pairs).
create or replace function link_blocked(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from user_blocks
                 where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a));
$$;
revoke all on function link_blocked(uuid, uuid) from public, anon, authenticated;

create or replace function link_permission(p_rel team_role) returns coach_permission
language sql immutable as $$
  select case when p_rel = 'head' then 'admin'::coach_permission else 'edit'::coach_permission end;
$$;

-- An admin coach asks another coach to join an athlete's team.
create or replace function request_co_coach(p_athlete_id uuid, p_coach_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not coach_can_admin(p_athlete_id) then raise exception 'only an admin coach can add coaches'; end if;
  if p_coach_id = auth.uid() or p_coach_id = p_athlete_id then raise exception 'pick another coach'; end if;
  if not exists (select 1 from profiles where id = p_coach_id and is_coach and suspended_at is null) then
    raise exception 'that account is not a coach';
  end if;
  if exists (select 1 from coach_athlete where coach_id = p_coach_id and athlete_id = p_athlete_id) then
    raise exception 'already on this team';
  end if;
  if link_blocked(p_coach_id, p_athlete_id) then
    raise exception 'this connection is blocked';
  end if;
  insert into link_requests (coach_id, athlete_id, relationship, requested_by, approver_id)
  values (p_coach_id, p_athlete_id, 'assistant', auth.uid(), p_coach_id)
  on conflict (coach_id, athlete_id) do update set requested_by = excluded.requested_by;
end;
$$;

-- A coach asks an existing athlete to join their roster. Same signature as
-- before, so clients keep calling it; it no longer links on its own.
create or replace function coach_add_athlete(p_athlete_id uuid, p_relationship text default 'assistant')
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_rel team_role;
begin
  if not exists (select 1 from profiles where id = auth.uid() and is_coach and suspended_at is null) then
    raise exception 'only coaches can add athletes';
  end if;
  if p_relationship not in ('head', 'assistant') then raise exception 'invalid role'; end if;
  v_rel := p_relationship::team_role;
  if not exists (select 1 from profiles where id = p_athlete_id and is_athlete) then
    raise exception 'that account is not an athlete';
  end if;
  if v_rel = 'head' and exists (
    select 1 from coach_athlete where athlete_id = p_athlete_id and relationship = 'head' and coach_id <> auth.uid()
  ) then
    raise exception 'this athlete already has a head coach — add them as a co-coach instead';
  end if;
  if exists (select 1 from coach_athlete where coach_id = auth.uid() and athlete_id = p_athlete_id) then
    raise exception 'already on your roster';
  end if;
  if link_blocked(auth.uid(), p_athlete_id) then
    raise exception 'this connection is blocked';
  end if;
  insert into link_requests (coach_id, athlete_id, relationship, requested_by, approver_id)
  values (auth.uid(), p_athlete_id, v_rel, auth.uid(), p_athlete_id)
  on conflict (coach_id, athlete_id) do update set relationship = excluded.relationship;
end;
$$;

-- A co-coach request stays valid only while its asker is still an admin
-- coach of the athlete.
create or replace function link_request_live(r link_requests) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select r.approver_id = r.athlete_id
      or exists (select 1 from coach_athlete ca join profiles p on p.id = ca.coach_id
                 where ca.athlete_id = r.athlete_id and ca.coach_id = r.requested_by
                   and ca.permission = 'admin' and p.is_coach);
$$;
revoke all on function link_request_live(link_requests) from public, anon, authenticated;

-- Requests waiting on me.
create or replace function my_link_requests()
returns table (id uuid, kind text, coach_id uuid, athlete_id uuid, relationship team_role,
               requester_name text, athlete_name text, created_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.id, case when r.approver_id = r.athlete_id then 'athlete' else 'co_coach' end,
         r.coach_id, r.athlete_id, r.relationship, q.name, a.name, r.created_at
  from link_requests r
  join profiles q on q.id = r.requested_by
  join profiles a on a.id = r.athlete_id
  where r.approver_id = auth.uid() and link_request_live(r)
  order by r.created_at desc;
$$;

-- Coaches invited to this athlete's team who haven't answered (admin coaches only).
create or replace function pending_co_coaches(p_athlete_id uuid)
returns table (id uuid, coach_id uuid, name text, initials text, avatar_url text, title text)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.id, p.id, p.name, p.initials, p.avatar_url, p.title
  from link_requests r join profiles p on p.id = r.coach_id
  where r.athlete_id = p_athlete_id and r.approver_id = r.coach_id
    and coach_can_admin(p_athlete_id)
  order by r.created_at;
$$;

create or replace function respond_link_request(p_id uuid, p_accept boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare r link_requests;
begin
  select * into r from link_requests where id = p_id and approver_id = auth.uid();
  if r.id is null then raise exception 'request not found'; end if;
  delete from link_requests where id = r.id;
  if not p_accept then return; end if;
  if not link_request_live(r) then raise exception 'this request is no longer valid'; end if;
  if r.relationship = 'head' and exists (
    select 1 from coach_athlete where athlete_id = r.athlete_id and relationship = 'head' and coach_id <> r.coach_id
  ) then
    raise exception 'you already have a head coach — ask them to add this coach as a co-coach';
  end if;
  insert into coach_athlete (coach_id, athlete_id, relationship, permission)
  values (r.coach_id, r.athlete_id, r.relationship, link_permission(r.relationship))
  on conflict (coach_id, athlete_id) do nothing;
end;
$$;

-- The asker, or any admin coach of the athlete, can withdraw a request.
create or replace function cancel_link_request(p_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  delete from link_requests
  where id = p_id and (requested_by = auth.uid() or coach_can_admin(athlete_id));
  if not found then raise exception 'request not found'; end if;
end;
$$;

-- search_athletes also says whether I've already asked.
drop function if exists search_athletes(text);
create function search_athletes(p_query text)
returns table (id uuid, name text, initials text, avatar_url text, already_on_roster boolean, requested boolean)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.name, p.initials, p.avatar_url,
         exists (select 1 from coach_athlete ca where ca.athlete_id = p.id and ca.coach_id = auth.uid()),
         exists (select 1 from link_requests r where r.athlete_id = p.id and r.coach_id = auth.uid())
  from profiles p
  where exists (select 1 from profiles c where c.id = auth.uid() and c.is_coach)
    and p.is_athlete
    and length(trim(p_query)) >= 2
    and (p.name ilike '%' || p_query || '%' or lower(p.email) = lower(trim(p_query)))
  order by p.name
  limit 20;
$$;

revoke all on function request_co_coach(uuid, uuid), coach_add_athlete(uuid, text), my_link_requests(),
  pending_co_coaches(uuid), respond_link_request(uuid, boolean), cancel_link_request(uuid),
  search_athletes(text) from public, anon;
grant execute on function request_co_coach(uuid, uuid), coach_add_athlete(uuid, text), my_link_requests(),
  pending_co_coaches(uuid), respond_link_request(uuid, boolean), cancel_link_request(uuid),
  search_athletes(text) to authenticated;
