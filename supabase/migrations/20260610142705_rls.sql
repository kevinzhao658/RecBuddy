-- ============================================================
-- RecBuddy — Row Level Security
-- Enforces: athletes see/edit their own data; a coach (head OR assistant)
-- can see/edit the athletes on their roster; chat is visible to the
-- athlete and any coach on their team.
-- Run AFTER 01_schema.sql.
-- ============================================================

-- Helper: is the current user a coach of this athlete? (head or assistant)
create or replace function is_coach_of(_athlete uuid) returns boolean as $$
  select exists (
    select 1 from coach_athlete
    where athlete_id = _athlete and coach_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public, pg_temp;

-- Helper: is the current user the head coach of this athlete?
create or replace function is_head_coach_of(_athlete uuid) returns boolean as $$
  select exists (
    select 1 from coach_athlete
    where athlete_id = _athlete and coach_id = auth.uid() and relationship = 'head'
  );
$$ language sql stable security definer set search_path = public, pg_temp;

-- Enable RLS everywhere
alter table profiles          enable row level security;
alter table coach_athlete     enable row level security;
alter table plans             enable row level security;
alter table workouts          enable row level security;
alter table workout_actuals   enable row level security;
alter table library_workouts  enable row level security;
alter table message_threads   enable row level security;
alter table messages          enable row level security;

-- ---------- profiles ----------
-- You can read your own profile, and profiles of people you're linked to.
create policy profiles_self_read on profiles for select
  using (
    id = auth.uid()
    or is_coach_of(id)                              -- coach reads their athletes
    or exists (select 1 from coach_athlete          -- athlete reads their coaches
               where athlete_id = auth.uid() and coach_id = profiles.id)
  );
create policy profiles_self_update on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- ---------- coach_athlete ----------
-- Visible to the athlete and to any coach on the row.
create policy team_read on coach_athlete for select
  using (athlete_id = auth.uid() or coach_id = auth.uid() or is_coach_of(athlete_id));
-- Only the HEAD coach manages the roster/team (add or remove assistants).
create policy team_write on coach_athlete for all
  using (is_head_coach_of(athlete_id) or (relationship = 'head' and coach_id = auth.uid()))
  with check (is_head_coach_of(athlete_id) or (relationship = 'head' and coach_id = auth.uid()));

-- ---------- plans ----------
create policy plans_read on plans for select
  using (athlete_id = auth.uid() or is_coach_of(athlete_id));
create policy plans_write on plans for all
  using (is_coach_of(athlete_id)) with check (is_coach_of(athlete_id));

-- ---------- workouts ----------
-- Athlete reads own + may update ONLY status (mark complete) — enforce the
-- column restriction in your API/RPC; RLS grants the row, app limits fields.
create policy workouts_read on workouts for select
  using (athlete_id = auth.uid() or is_coach_of(athlete_id));
create policy workouts_coach_write on workouts for all
  using (is_coach_of(athlete_id)) with check (is_coach_of(athlete_id));

-- ---------- workout_actuals ----------
create policy actuals_read on workout_actuals for select
  using (athlete_id = auth.uid() or is_coach_of(athlete_id));
create policy actuals_write on workout_actuals for all
  using (athlete_id = auth.uid() or is_coach_of(athlete_id))
  with check (athlete_id = auth.uid() or is_coach_of(athlete_id));

-- ---------- library_workouts ----------
-- A coach owns their own library only.
create policy library_owner on library_workouts for all
  using (coach_id = auth.uid()) with check (coach_id = auth.uid());

-- ---------- message_threads ----------
create policy threads_read on message_threads for select
  using (athlete_id = auth.uid() or coach_id = auth.uid() or is_coach_of(athlete_id));
create policy threads_write on message_threads for all
  using (athlete_id = auth.uid() or coach_id = auth.uid() or is_coach_of(athlete_id))
  with check (athlete_id = auth.uid() or coach_id = auth.uid() or is_coach_of(athlete_id));

-- ---------- messages ----------
-- Visible to thread participants (athlete + the thread's coach + that
-- athlete's wider coaching team, since assistants "follow the chat").
create policy messages_read on messages for select
  using (exists (
    select 1 from message_threads t
    where t.id = messages.thread_id
      and (t.athlete_id = auth.uid() or t.coach_id = auth.uid() or is_coach_of(t.athlete_id))
  ));
create policy messages_send on messages for insert
  with check (
    from_user_id = auth.uid()
    and exists (
      select 1 from message_threads t
      where t.id = thread_id
        and (t.athlete_id = auth.uid() or t.coach_id = auth.uid() or is_coach_of(t.athlete_id))
    )
  );
-- mark-as-read updates
create policy messages_update on messages for update
  using (exists (
    select 1 from message_threads t
    where t.id = messages.thread_id
      and (t.athlete_id = auth.uid() or t.coach_id = auth.uid() or is_coach_of(t.athlete_id))
  ));

-- ============================================================
-- Realtime: add the tables you want to stream
-- ============================================================
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table workouts;

-- Block privilege escalation via a direct profile update: only the service
-- role may change role/title. Users may still edit their other profile fields.
-- SECURITY INVOKER (default) so current_user is the caller's role, not the owner.
create or replace function guard_profile_privileged_fields() returns trigger as $$
begin
  if (new.role is distinct from old.role or new.title is distinct from old.title)
     and current_user <> 'service_role' then
    raise exception 'role/title may only be changed by the service role';
  end if;
  return new;
end;
$$ language plpgsql set search_path = public, pg_temp;

create trigger profiles_guard_privileged before update on profiles
  for each row execute function guard_profile_privileged_fields();
