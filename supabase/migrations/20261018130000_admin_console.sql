-- Admin console (coach-web /admin): moderate reports, look up users, settle
-- coach–athlete disputes, with an audit trail of every admin action.
--
-- Access model:
--   * profiles.is_admin is granted ONLY with the service role / SQL editor:
--       update profiles set is_admin = true where email = 'you@…';
--   * Every read/write below is a SECURITY DEFINER RPC that checks is_admin().
--     Admin tables have RLS on with no client policies.
--   * Actions needing the Auth admin API or Storage (suspend/unsuspend, delete
--     a message + its photo) go through the admin-action Edge Function, which
--     re-checks is_admin and writes the same audit log.

-- ============================================================
-- 1. Flags
-- ============================================================
alter table profiles add column if not exists is_admin boolean not null default false;
alter table profiles add column if not exists suspended_at timestamptz;
alter table profiles add column if not exists suspended_reason text;

-- Same guard as 20260706190000, extended: users can't make themselves admin
-- or lift their own suspension.
create or replace function guard_profile_privileged_fields() returns trigger as $$
begin
  if (new.role is distinct from old.role
      or new.title is distinct from old.title
      or new.is_coach is distinct from old.is_coach
      or new.is_athlete is distinct from old.is_athlete
      or new.is_admin is distinct from old.is_admin
      or new.suspended_at is distinct from old.suspended_at
      or new.suspended_reason is distinct from old.suspended_reason)
     and current_user not in ('service_role', 'postgres') then
    raise exception 'role fields may only be changed by the service role';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public, pg_temp;

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select is_admin and suspended_at is null from profiles where id = auth.uid()), false);
$$;

-- Suspended users can't post (Auth also bans them; this closes the window
-- until their current access token expires).
create or replace function messages_language_filter() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from profiles where id = new.from_user_id and suspended_at is not null) then
    raise exception 'account suspended';
  end if;
  if contains_blocked_term(new.body)
     or contains_blocked_term(new.payload->>'note')
     or contains_blocked_term(new.payload->>'reason') then
    raise exception 'message contains language that isn''t allowed';
  end if;
  return new;
end;
$$;

-- ============================================================
-- 2. Report resolution + audit log
-- ============================================================
alter table content_reports add column if not exists resolved_by uuid references profiles(id) on delete set null;
alter table content_reports add column if not exists resolution_note text;

create table admin_actions (
  id              uuid primary key default gen_random_uuid(),
  admin_id        uuid references profiles(id) on delete set null,
  action          text not null,     -- resolve_report | delete_message | suspend | unsuspend | delete_user | remove_link | set_head
  target_user_id  uuid references profiles(id) on delete set null,
  report_id       uuid references content_reports(id) on delete set null,
  message_id      uuid,              -- no FK: the message may be the thing deleted
  note            text,
  details         jsonb,
  created_at      timestamptz not null default now()
);
create index on admin_actions (created_at desc);
create index on admin_actions (target_user_id);
alter table admin_actions enable row level security; -- no client policies

-- Per-admin triage marks: starred + read state (each admin has their own).
create table admin_report_marks (
  admin_id   uuid not null references profiles(id) on delete cascade,
  report_id  uuid not null references content_reports(id) on delete cascade,
  starred    boolean not null default false,
  read_at    timestamptz,
  primary key (admin_id, report_id)
);
alter table admin_report_marks enable row level security; -- no client policies

create or replace function admin_log(p_action text, p_target uuid, p_report uuid, p_message uuid,
                                     p_note text, p_details jsonb default null) returns void
language sql security definer set search_path = public, pg_temp as $$
  insert into admin_actions (admin_id, action, target_user_id, report_id, message_id, note, details)
  values (auth.uid(), p_action, p_target, p_report, p_message, nullif(trim(p_note), ''), p_details);
$$;

create or replace function assert_admin() returns void
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not is_admin() then raise exception 'admin only'; end if;
end;
$$;

-- ============================================================
-- 3. Reports
-- ============================================================
create or replace function admin_list_reports(p_status text default 'open')
returns table (
  id uuid, reason text, details text, status text, created_at timestamptz,
  resolved_at timestamptz, resolution_note text, message_id uuid, content_snapshot jsonb,
  reporter_id uuid, reporter_name text, reporter_email text,
  reported_user_id uuid, reported_name text, reported_email text,
  reported_suspended_at timestamptz, reported_open_reports int,
  actions_taken text[],  -- enforcement actions already taken on this report (gates "Mark actioned")
  starred boolean,       -- the calling admin's own marks
  read_at timestamptz
)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform assert_admin();
  return query
  select r.id, r.reason, r.details, r.status, r.created_at, r.resolved_at, r.resolution_note,
         r.message_id, r.content_snapshot,
         r.reporter_id, rp.name, rp.email,
         r.reported_user_id, tp.name, tp.email, tp.suspended_at,
         (select count(*)::int from content_reports o
           where o.reported_user_id = r.reported_user_id and o.status = 'open'),
         coalesce((select array_agg(distinct x.action) from admin_actions x
                    where x.report_id = r.id and x.action <> 'resolve_report'), '{}'),
         coalesce(mk.starred, false), mk.read_at
  from content_reports r
  left join admin_report_marks mk on mk.report_id = r.id and mk.admin_id = auth.uid()
  left join profiles rp on rp.id = r.reporter_id
  left join profiles tp on tp.id = r.reported_user_id
  where p_status is null or r.status = p_status
  order by r.created_at desc
  -- A status tab shows the latest 200; p_status = null is the full export.
  limit case when p_status is null then null else 200 end;
end;
$$;

-- The conversation around a reported message: up to 3 messages before and 3
-- after (the message may since be deleted — the snapshot's thread_id +
-- sent_at still anchor the window).
create or replace function admin_report_context(p_report_id uuid)
returns table (id uuid, from_user_id uuid, sender_name text, kind text, body text,
               payload jsonb, created_at timestamptz, is_reported boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_thread uuid; v_at timestamptz; v_msg uuid;
begin
  perform assert_admin();
  select (r.content_snapshot->>'thread_id')::uuid, (r.content_snapshot->>'sent_at')::timestamptz, r.message_id
    into v_thread, v_at, v_msg
  from content_reports r where r.id = p_report_id;
  if v_thread is null then return; end if;
  return query
  (select m.id, m.from_user_id, p.name, m.kind::text, m.body, m.payload, m.created_at, m.id = v_msg
     from messages m left join profiles p on p.id = m.from_user_id
    where m.thread_id = v_thread and m.created_at <= v_at
    order by m.created_at desc limit 4)
  union all
  (select m.id, m.from_user_id, p.name, m.kind::text, m.body, m.payload, m.created_at, m.id = v_msg
     from messages m left join profiles p on p.id = m.from_user_id
    where m.thread_id = v_thread and m.created_at > v_at
    order by m.created_at asc limit 3)
  order by 7;
end;
$$;

create or replace function admin_resolve_report(p_report_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user uuid;
begin
  perform assert_admin();
  if p_status not in ('open', 'actioned', 'dismissed') then raise exception 'invalid status'; end if;
  -- "Actioned" means something was done: require an enforcement action first.
  if p_status = 'actioned' and not exists (
    select 1 from admin_actions where report_id = p_report_id and action <> 'resolve_report'
  ) then
    raise exception 'take an action (delete, suspend, or remove) before marking actioned';
  end if;
  update content_reports
     set status = p_status,
         resolved_at = case when p_status = 'open' then null else now() end,
         resolved_by = case when p_status = 'open' then null else auth.uid() end,
         resolution_note = nullif(trim(p_note), '')
   where id = p_report_id
  returning reported_user_id into v_user;
  if not found then raise exception 'report not found'; end if;
  perform admin_log('resolve_report', v_user, p_report_id, null, p_note, jsonb_build_object('status', p_status));
end;
$$;

-- Star / unstar and read / unread for the calling admin. null = leave as is.
create or replace function admin_mark_report(p_report_id uuid, p_read boolean default null, p_starred boolean default null)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform assert_admin();
  insert into admin_report_marks (admin_id, report_id, starred, read_at)
  values (auth.uid(), p_report_id, coalesce(p_starred, false), case when p_read then now() end)
  on conflict (admin_id, report_id) do update set
    starred = coalesce(p_starred, admin_report_marks.starred),
    read_at = case when p_read is null then admin_report_marks.read_at
                   when p_read then coalesce(admin_report_marks.read_at, now()) else null end;
end;
$$;

-- ============================================================
-- 4. Users + disputes
-- ============================================================
create or replace function admin_search_users(p_query text default null)
returns table (id uuid, name text, email text, is_coach boolean, is_athlete boolean, is_admin boolean,
               suspended_at timestamptz, reports_against int, reports_by int)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform assert_admin();
  return query
  select p.id, p.name, p.email, p.is_coach, p.is_athlete, p.is_admin, p.suspended_at,
         (select count(*)::int from content_reports r where r.reported_user_id = p.id),
         (select count(*)::int from content_reports r where r.reporter_id = p.id)
  from profiles p
  where coalesce(trim(p_query), '') = ''
     or p.name ilike '%' || trim(p_query) || '%'
     or p.email ilike '%' || trim(p_query) || '%'
     or p.id::text = trim(p_query)
  order by p.suspended_at desc nulls last, p.name
  limit 50;
end;
$$;

create or replace function admin_user_detail(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v jsonb;
begin
  perform assert_admin();
  select jsonb_build_object(
    'profile', (select jsonb_build_object('id', p.id, 'name', p.name, 'email', p.email,
                  'is_coach', p.is_coach, 'is_athlete', p.is_athlete, 'is_admin', p.is_admin,
                  'suspended_at', p.suspended_at, 'suspended_reason', p.suspended_reason)
                from profiles p where p.id = p_user_id),
    'coaches', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'email', c.email,
                  'relationship', ca.relationship, 'permission', ca.permission) order by ca.relationship, c.name)
                from coach_athlete ca join profiles c on c.id = ca.coach_id
                where ca.athlete_id = p_user_id), '[]'),
    'athletes', coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'email', a.email,
                  'relationship', ca.relationship, 'permission', ca.permission) order by a.name)
                from coach_athlete ca join profiles a on a.id = ca.athlete_id
                where ca.coach_id = p_user_id), '[]'),
    'blocked', coalesce((select jsonb_agg(jsonb_build_object('id', b.blocked_id, 'name', p.name, 'at', b.created_at))
                from user_blocks b left join profiles p on p.id = b.blocked_id
                where b.blocker_id = p_user_id), '[]'),
    'blocked_by', coalesce((select jsonb_agg(jsonb_build_object('id', b.blocker_id, 'name', p.name, 'at', b.created_at))
                from user_blocks b left join profiles p on p.id = b.blocker_id
                where b.blocked_id = p_user_id), '[]'),
    'reports_against', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'reason', r.reason,
                  'status', r.status, 'created_at', r.created_at) order by r.created_at desc)
                from content_reports r where r.reported_user_id = p_user_id), '[]'),
    'reports_by', coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'reason', r.reason,
                  'status', r.status, 'created_at', r.created_at) order by r.created_at desc)
                from content_reports r where r.reporter_id = p_user_id), '[]'),
    'actions', coalesce((select jsonb_agg(jsonb_build_object('action', x.action, 'note', x.note,
                  'admin', ap.name, 'created_at', x.created_at) order by x.created_at desc)
                from admin_actions x left join profiles ap on ap.id = x.admin_id
                where x.target_user_id = p_user_id), '[]')
  ) into v;
  if v->'profile' is null or v->'profile' = 'null'::jsonb then raise exception 'user not found'; end if;
  return v;
end;
$$;

-- Dispute tool: end a coach–athlete link (e.g. a coach who won't let go).
create or replace function admin_remove_link(p_coach_id uuid, p_athlete_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform assert_admin();
  delete from coach_athlete where coach_id = p_coach_id and athlete_id = p_athlete_id;
  if not found then raise exception 'link not found'; end if;
  perform admin_log('remove_link', p_athlete_id, null, null, p_note, jsonb_build_object('coach_id', p_coach_id));
end;
$$;

-- Dispute tool: make another team coach the head coach.
create or replace function admin_set_head(p_coach_id uuid, p_athlete_id uuid, p_note text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform assert_admin();
  if not exists (select 1 from coach_athlete where coach_id = p_coach_id and athlete_id = p_athlete_id) then
    raise exception 'that coach is not on this athlete''s team';
  end if;
  update coach_athlete set relationship = 'assistant'
   where athlete_id = p_athlete_id and relationship = 'head' and coach_id <> p_coach_id;
  update coach_athlete set relationship = 'head', permission = 'admin'
   where athlete_id = p_athlete_id and coach_id = p_coach_id;
  perform admin_log('set_head', p_athlete_id, null, null, p_note, jsonb_build_object('coach_id', p_coach_id));
end;
$$;

create or replace function admin_list_actions(p_limit int default 100)
returns table (id uuid, action text, note text, details jsonb, created_at timestamptz,
               admin_name text, target_user_id uuid, target_name text, report_id uuid)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform assert_admin();
  return query
  select x.id, x.action, x.note, x.details, x.created_at, ap.name, x.target_user_id, tp.name, x.report_id
  from admin_actions x
  left join profiles ap on ap.id = x.admin_id
  left join profiles tp on tp.id = x.target_user_id
  order by x.created_at desc
  limit least(greatest(p_limit, 1), 500);
end;
$$;

-- ============================================================
-- Grants
-- ============================================================
revoke all on function admin_log(text, uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function assert_admin() from public, anon;
grant execute on function assert_admin() to authenticated;
revoke all on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

do $$
declare f text;
begin
  foreach f in array array[
    'admin_list_reports(text)', 'admin_report_context(uuid)', 'admin_resolve_report(uuid, text, text)',
    'admin_mark_report(uuid, boolean, boolean)',
    'admin_search_users(text)', 'admin_user_detail(uuid)', 'admin_remove_link(uuid, uuid, text)',
    'admin_set_head(uuid, uuid, text)', 'admin_list_actions(int)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
