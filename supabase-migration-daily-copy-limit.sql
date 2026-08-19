-- ============================================================
-- CUE — Enforce "2 AI prompts per day" for free users
-- ============================================================
-- Cue+ plans are unlimited. Free / not-yet-paid users can copy at
-- most 2 prompts per rolling 24h window (per user_id). Reuses the
-- existing `rate_limit_windows` table — no new schema, just an RPC.
-- ============================================================

create or replace function public.record_daily_copy(p_user_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan         text;
  v_today        date := (now() at time zone 'utc')::date;
  v_key          text;
  v_window       record;
  v_now          timestamptz := now();
  v_reset        timestamptz;
  v_count        int;
  v_limit        int := 2;
begin
  if p_user_id is null or p_user_id = '' then
    return json_build_object('allowed', false, 'reason', 'no user', 'remaining', 0);
  end if;

  -- Cue+ users: unlimited.
  select plan into v_plan
  from public.user_profiles
  where user_id = p_user_id
  limit 1;

  if v_plan in ('cue_plus', 'cue_plus_team') then
    return json_build_object('allowed', true, 'remaining', -1, 'plan', v_plan);
  end if;

  -- Free users: per-user, per-day window.
  v_key := 'copy:' || p_user_id || ':' || to_char(v_today, 'YYYY-MM-DD');

  select count, reset_at into v_window
  from public.rate_limit_windows
  where key = v_key
  limit 1;

  if v_window.reset_at is null or v_window.reset_at < v_now then
    -- Fresh window: reset at start of tomorrow (UTC).
    v_reset := (v_today + interval '1 day')::timestamptz;
    v_count := 1;
    insert into public.rate_limit_windows (key, count, reset_at)
    values (v_key, v_count, v_reset)
    on conflict (key) do update
      set count = 1, reset_at = excluded.reset_at;
  else
    v_reset := v_window.reset_at;
    if v_window.count >= v_limit then
      return json_build_object(
        'allowed',   false,
        'reason',    'daily limit',
        'remaining', 0,
        'reset_at',  v_reset,
        'limit',     v_limit,
        'plan',      coalesce(v_plan, 'free')
      );
    end if;
    v_count := v_window.count + 1;
    update public.rate_limit_windows
       set count = v_count
     where key = v_key;
  end if;

  return json_build_object(
    'allowed',   true,
    'remaining', greatest(v_limit - v_count, 0),
    'reset_at',  v_reset,
    'limit',     v_limit,
    'plan',      coalesce(v_plan, 'free')
  );
end;
$$;

revoke execute on function public.record_daily_copy(text) from public;
grant  execute on function public.record_daily_copy(text) to anon, authenticated, service_role;

-- Companion: peek the remaining count WITHOUT incrementing.
-- Used by the Modal on open so the counter renders correctly before
-- the user has clicked anything yet.
create or replace function public.peek_daily_copy(p_user_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan  text;
  v_today date := (now() at time zone 'utc')::date;
  v_key   text;
  v_row   record;
  v_limit int := 2;
begin
  if p_user_id is null or p_user_id = '' then
    return json_build_object('allowed', false, 'remaining', 0);
  end if;

  select plan into v_plan
  from public.user_profiles
  where user_id = p_user_id
  limit 1;

  if v_plan in ('cue_plus', 'cue_plus_team') then
    return json_build_object('allowed', true, 'remaining', -1, 'plan', v_plan);
  end if;

  v_key := 'copy:' || p_user_id || ':' || to_char(v_today, 'YYYY-MM-DD');

  select count, reset_at into v_row
  from public.rate_limit_windows
  where key = v_key
  limit 1;

  if v_row.count is null or v_row.reset_at < now() then
    return json_build_object('allowed', true, 'remaining', v_limit, 'limit', v_limit, 'plan', coalesce(v_plan, 'free'));
  end if;

  return json_build_object(
    'allowed',   v_row.count < v_limit,
    'remaining', greatest(v_limit - v_row.count, 0),
    'reset_at',  v_row.reset_at,
    'limit',     v_limit,
    'plan',      coalesce(v_plan, 'free')
  );
end;
$$;

revoke execute on function public.peek_daily_copy(text) from public;
grant  execute on function public.peek_daily_copy(text) to anon, authenticated, service_role;

-- ============================================================
-- Rollback (non-destructive)
--   drop function if exists public.record_daily_copy(text);
--   drop function if exists public.peek_daily_copy(text);
-- rate_limit_windows rows will decay naturally; delete rows with
-- key like 'copy:%' if you want to reset counters.
-- ============================================================
