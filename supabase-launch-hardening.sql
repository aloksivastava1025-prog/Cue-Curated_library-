-- ============================================================
-- CUE — Launch hardening (P0/P1 pre-launch DB migration)
-- ============================================================
-- Additive only. Safe to run multiple times. Rollback notes at the
-- end of the file.
--
-- Contents
--   1. payment_id UNIQUE index across payment_events payloads
--      (defense-in-depth against Dodo re-sending the same payment
--      under a different webhook-id, which would bypass the PK-based
--      idempotency check).
--   2. Scheduled reconciliation via pg_cron every 10 minutes
--      (only creates the schedule if pg_cron is installed on this
--      Supabase project — no error if not).
--   3. Purchase-metrics helper view for founding-count / analytics.
-- ============================================================

-- 1. Unique on payment_id inside payment_events payload -----------
-- Enforce that the same Dodo payment_id can only ever create ONE
-- payment_events row, regardless of the webhook-id header.
create unique index if not exists payment_events_payment_id_uidx
  on public.payment_events (
    (payload->'data'->>'payment_id')
  )
  where (payload->'data'->>'payment_id') is not null
    and event_type = 'payment.succeeded';

-- 2. Scheduled reconciliation (pg_cron, if installed) -------------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    -- Remove any prior schedule with the same name (idempotent apply).
    perform cron.unschedule('cue-reconcile-paid-but-locked')
      where exists (
        select 1 from cron.job where jobname = 'cue-reconcile-paid-but-locked'
      );
    perform cron.schedule(
      'cue-reconcile-paid-but-locked',
      '*/10 * * * *',
      $cron$select public.reconcile_paid_but_locked()$cron$
    );
    raise notice 'pg_cron schedule installed';
  else
    raise notice 'pg_cron not installed — scheduled reconciliation NOT enabled. The reconcile RPC still runs on-demand from /billing/success and can be called manually.';
  end if;
end
$$;

-- 3. Founding purchase count (used by the pricing card) -----------
create or replace view public.founding_purchases as
  select
    user_id,
    email,
    plan,
    plan_source,
    plan_started_at,
    dodo_customer_id
  from public.user_profiles
  where plan in ('cue_plus', 'cue_plus_team')
    and (plan_source = 'dodo' or plan_source = 'reconciliation');

comment on view public.founding_purchases is
  'Read-only view of active paid users. Used by getFoundingCount() and admin reporting.';

grant select on public.founding_purchases to anon, authenticated, service_role;

-- ============================================================
-- Rollback (safe, non-destructive)
-- ============================================================
--   drop index if exists public.payment_events_payment_id_uidx;
--   select cron.unschedule('cue-reconcile-paid-but-locked');
--   drop view if exists public.founding_purchases;
--
-- No user data is touched by any statement above; this migration is
-- indexes + a view + a cron entry only.
-- ============================================================
