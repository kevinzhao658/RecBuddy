-- Link request fixes from security review (2026-10-24).
--   1. A second request for the same coach+athlete used to update only one
--      column, keeping the old approver. An invited co-coach could re-ask as
--      head and then approve it themselves. A new request now replaces every
--      field, so the right person approves it, and only the athlete can ever
--      approve a head request.
--   2. A block between coach and athlete makes any pending request between
--      them lapse.

alter table link_requests drop constraint if exists link_requests_head_needs_athlete;
delete from link_requests where relationship = 'head' and approver_id <> athlete_id;
alter table link_requests add constraint link_requests_head_needs_athlete
  check (relationship = 'assistant' or approver_id = athlete_id);

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
  if link_blocked(p_coach_id, p_athlete_id) then raise exception 'this connection is blocked'; end if;
  insert into link_requests (coach_id, athlete_id, relationship, requested_by, approver_id)
  values (p_coach_id, p_athlete_id, 'assistant', auth.uid(), p_coach_id)
  on conflict (coach_id, athlete_id) do update
    set relationship = excluded.relationship, requested_by = excluded.requested_by,
        approver_id = excluded.approver_id, created_at = now();
end;
$$;

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
  if link_blocked(auth.uid(), p_athlete_id) then raise exception 'this connection is blocked'; end if;
  insert into link_requests (coach_id, athlete_id, relationship, requested_by, approver_id)
  values (auth.uid(), p_athlete_id, v_rel, auth.uid(), p_athlete_id)
  on conflict (coach_id, athlete_id) do update
    set relationship = excluded.relationship, requested_by = excluded.requested_by,
        approver_id = excluded.approver_id, created_at = now();
end;
$$;

create or replace function link_request_live(r link_requests) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select not link_blocked(r.coach_id, r.athlete_id)
     and (r.approver_id = r.athlete_id
          or exists (select 1 from coach_athlete ca join profiles p on p.id = ca.coach_id
                     where ca.athlete_id = r.athlete_id and ca.coach_id = r.requested_by
                       and ca.permission = 'admin' and p.is_coach));
$$;

create or replace function pending_co_coaches(p_athlete_id uuid)
returns table (id uuid, coach_id uuid, name text, initials text, avatar_url text, title text)
language sql stable security definer set search_path = public, pg_temp as $$
  select r.id, p.id, p.name, p.initials, p.avatar_url, p.title
  from link_requests r join profiles p on p.id = r.coach_id
  where r.athlete_id = p_athlete_id and r.approver_id = r.coach_id
    and coach_can_admin(p_athlete_id) and link_request_live(r)
  order by r.created_at;
$$;
