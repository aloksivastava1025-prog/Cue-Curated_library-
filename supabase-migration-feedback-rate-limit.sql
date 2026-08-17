-- ============================================================
-- CUE — Feedback spam guard
-- Blocks bursts: no more than 3 feedback submissions from the same
-- email (or same referrer if email is null) within 10 minutes.
-- Run once in Supabase SQL Editor. Safe to re-run.
-- ============================================================

create or replace function public.feedback_rate_limit()
returns trigger language plpgsql as $$
declare
  since timestamptz := now() - interval '10 minutes';
  cnt   int;
begin
  if new.email is not null then
    select count(*) into cnt
      from public.feedback
      where email = new.email
        and created_at > since;
  else
    select count(*) into cnt
      from public.feedback
      where referrer is not distinct from new.referrer
        and email is null
        and created_at > since;
  end if;

  if cnt >= 3 then
    raise exception 'feedback rate limit exceeded: try again in a few minutes';
  end if;
  return new;
end;
$$;

drop trigger if exists feedback_rate_limit on public.feedback;
create trigger feedback_rate_limit
  before insert on public.feedback
  for each row execute function public.feedback_rate_limit();
