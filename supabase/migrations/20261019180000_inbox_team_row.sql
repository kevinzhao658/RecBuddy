-- The athlete's team thread is created lazily (team_thread_id). The inbox lists
-- only threads that exist, so a newly linked athlete saw "No chats yet" until
-- someone posted. my_conversations now makes sure the caller's team thread
-- exists first, so every client shows it without a separate call.
alter function my_conversations() rename to inbox_rows;
revoke all on function inbox_rows() from public, anon, authenticated;

create or replace function my_conversations()
returns table (thread_id uuid, kind text, title text, team_athlete_id uuid, members jsonb,
               last_body text, last_kind text, last_from uuid, last_at timestamptz,
               unread int, read_only boolean)
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if exists (select 1 from coach_athlete ca where ca.athlete_id = auth.uid())
     and not exists (select 1 from message_threads t where t.kind = 'team' and t.athlete_id = auth.uid()) then
    begin
      perform team_thread_id(auth.uid());
    exception when others then
      null;  -- never fail the inbox over it; the next load retries
    end;
  end if;
  return query select * from inbox_rows();
end;
$$;
revoke all on function my_conversations() from public, anon;
grant execute on function my_conversations() to authenticated;
