-- ============================================================
-- CUE — 15-prompts-per-cycle cap for MONTHLY subscribers
-- ============================================================
-- Policy:
--   • Lifetime Cue+ (no subscription_id) → unlimited (unchanged)
--   • Cue+ Team    (no subscription_id) → unlimited (unchanged)
--   • Monthly Cue+ (dodo_subscription_id set) → 15 prompt copies
--     per billing cycle. When they hit the cap, the UI shows a
--     "Contact Alok on X for more" message.
--   • Free users    → 2 per rolling 24h window (unchanged)
--
-- Uses the same `rate_limit_windows` table as daily copy counting.
-- The key is prefixed `monthly-copy:` so it never collides with the
-- daily counter (`copy:...`).
-- ============================================================

create or replace function public.record_daily_copy(p_user_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan            text;
  v_sub_id          text;
  v_next_bill       timestamptz;
  v_today           date := (now() at time zone 'utc')::date;
  v_key             text;
  v_window          record;
  v_now             timestamptz := now();
  v_reset           timestamptz;
  v_count           int;
  v_free_limit      int := 2;
  v_monthly_limit   int := 15;
  v_cycle_anchor    text;
begin
  if p_user_id is null or p_user_id = '' then
    return json_build_object('allowed', false, 'reason', 'no user', 'remaining', 0);
  end if;

  select plan, dodo_subscription_id, next_billing_date
    into v_plan, v_sub_id, v_next_bill
  from public.user_profiles
  where user_id = p_user_id
  limit 1;

  -- Team plans: unlimited (lifetime team pass).
  if v_plan = 'cue_plus_team' then
    return json_build_object('allowed', true, 'remaining', -1, 'plan', v_plan, 'tier', 'team');
  end if;

  -- Lifetime individual Cue+ (no subscription_id): unlimited.
  if v_plan = 'cue_plus' and (v_sub_id is null or v_sub_id = '') then
    return json_build_object('allowed', true, 'remaining', -1, 'plan', v_plan, 'tier', 'lifetime');
  end if;

  -- Monthly Cue+ (has active dodo_subscription_id): 15 per billing cycle.
  if v_plan = 'cue_plus' and v_sub_id is not null and v_sub_id <> '' then
    -- Anchor the cycle to the next billing date so the window
    -- rolls with the actual subscription anniversary, not a
    -- calendar month. Fallback to a 30-day window from today
    -- when the webhook hasn't populated next_billing_date yet.
    v_reset := coalesce(v_next_bill, v_now + interval '30 days');
    v_cycle_anchor := to_char(v_reset, 'YYYY-MM-DD');
    v_key := 'monthly-copy:' || p_user_id || ':' || v_cycle_anchor;

    select count, reset_at into v_window
    from public.rate_limit_windows
    where key = v_key
    limit 1;

    if v_window.count is null then
      v_count := 1;
      insert into public.rate_limit_windows (key, count, reset_at)
      values (v_key, v_count, v_reset)
      on conflict (key) do update
        set count = 1, reset_at = excluded.reset_at;
    elsif v_window.count >= v_monthly_limit then
      return json_build_object(
        'allowed',   false,
        'reason',    'monthly limit',
        'remaining', 0,
        'reset_at',  v_reset,
        'limit',     v_monthly_limit,
        'plan',      v_plan,
        'tier',      'monthly'
      );
    else
      v_count := v_window.count + 1;
      update public.rate_limit_windows
         set count = v_count
       where key = v_key;
    end if;

    return json_build_object(
      'allowed',   true,
      'remaining', greatest(v_monthly_limit - v_count, 0),
      'reset_at',  v_reset,
      'limit',     v_monthly_limit,
      'plan',      v_plan,
      'tier',      'monthly'
    );
  end if;

  -- Free users: per-user, per-day window (2 copies).
  v_key := 'copy:' || p_user_id || ':' || to_char(v_today, 'YYYY-MM-DD');

  select count, reset_at into v_window
  from public.rate_limit_windows
  where key = v_key
  limit 1;

  if v_window.reset_at is null or v_window.reset_at < v_now then
    v_reset := (v_today + interval '1 day')::timestamptz;
    v_count := 1;
    insert into public.rate_limit_windows (key, count, reset_at)
    values (v_key, v_count, v_reset)
    on conflict (key) do update
      set count = 1, reset_at = excluded.reset_at;
  else
    v_reset := v_window.reset_at;
    if v_window.count >= v_free_limit then
      return json_build_object(
        'allowed',   false,
        'reason',    'daily limit',
        'remaining', 0,
        'reset_at',  v_reset,
        'limit',     v_free_limit,
        'plan',      coalesce(v_plan, 'free'),
        'tier',      'free'
      );
    end if;
    v_count := v_window.count + 1;
    update public.rate_limit_windows
       set count = v_count
     where key = v_key;
  end if;

  return json_build_object(
    'allowed',   true,
    'remaining', greatest(v_free_limit - v_count, 0),
    'reset_at',  v_reset,
    'limit',     v_free_limit,
    'plan',      coalesce(v_plan, 'free'),
    'tier',      'free'
  );
end;
$$;

revoke execute on function public.record_daily_copy(text) from public;
grant  execute on function public.record_daily_copy(text) to anon, authenticated, service_role;

-- Peek variant: reads the counter without incrementing. Same three-
-- tier logic, so the modal can render "N of 15 used" before the user
-- even clicks Copy.
create or replace function public.peek_daily_copy(p_user_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan            text;
  v_sub_id          text;
  v_next_bill       timestamptz;
  v_today           date := (now() at time zone 'utc')::date;
  v_key             text;
  v_row             record;
  v_free_limit      int := 2;
  v_monthly_limit   int := 15;
  v_cycle_anchor    text;
begin
  if p_user_id is null or p_user_id = '' then
    return json_build_object('allowed', false, 'remaining', 0);
  end if;

  select plan, dodo_subscription_id, next_billing_date
    into v_plan, v_sub_id, v_next_bill
  from public.user_profiles
  where user_id = p_user_id
  limit 1;

  if v_plan = 'cue_plus_team' then
    return json_build_object('allowed', true, 'remaining', -1, 'plan', v_plan, 'tier', 'team');
  end if;
  if v_plan = 'cue_plus' and (v_sub_id is null or v_sub_id = '') then
    return json_build_object('allowed', true, 'remaining', -1, 'plan', v_plan, 'tier', 'lifetime');
  end if;

  if v_plan = 'cue_plus' and v_sub_id is not null and v_sub_id <> '' then
    v_cycle_anchor := to_char(coalesce(v_next_bill, now() + interval '30 days'), 'YYYY-MM-DD');
    v_key := 'monthly-copy:' || p_user_id || ':' || v_cycle_anchor;
    select count, reset_at into v_row
    from public.rate_limit_windows
    where key = v_key
    limit 1;
    if v_row.count is null then
      return json_build_object('allowed', true, 'remaining', v_monthly_limit, 'limit', v_monthly_limit, 'plan', v_plan, 'tier', 'monthly');
    end if;
    return json_build_object(
      'allowed',   v_row.count < v_monthly_limit,
      'remaining', greatest(v_monthly_limit - v_row.count, 0),
      'reset_at',  v_row.reset_at,
      'limit',     v_monthly_limit,
      'plan',      v_plan,
      'tier',      'monthly'
    );
  end if;

  v_key := 'copy:' || p_user_id || ':' || to_char(v_today, 'YYYY-MM-DD');
  select count, reset_at into v_row
  from public.rate_limit_windows
  where key = v_key
  limit 1;
  if v_row.count is null or v_row.reset_at < now() then
    return json_build_object('allowed', true, 'remaining', v_free_limit, 'limit', v_free_limit, 'plan', coalesce(v_plan, 'free'), 'tier', 'free');
  end if;
  return json_build_object(
    'allowed',   v_row.count < v_free_limit,
    'remaining', greatest(v_free_limit - v_row.count, 0),
    'reset_at',  v_row.reset_at,
    'limit',     v_free_limit,
    'plan',      coalesce(v_plan, 'free'),
    'tier',      'free'
  );
end;
$$;

revoke execute on function public.peek_daily_copy(text) from public;
grant  execute on function public.peek_daily_copy(text) to anon, authenticated, service_role;
