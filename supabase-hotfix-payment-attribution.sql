-- ============================================================
-- CUE — Hotfix: payment attribution + reconciliation
-- Root cause: Dodo hosted checkout URLs don't reliably propagate URL
-- metadata into the webhook payload, so payment.succeeded events landed
-- with user_id=NULL and buyers were left locked despite paying.
-- ============================================================

-- 1. Add dodo_customer_id column for source-of-truth attribution ----
alter table public.user_profiles
  add column if not exists dodo_customer_id text;

create index if not exists user_profiles_dodo_customer_id_idx
  on public.user_profiles (dodo_customer_id)
  where dodo_customer_id is not null;

create index if not exists user_profiles_email_idx
  on public.user_profiles (lower(email))
  where email is not null;

-- 2. Merge-by-email helper — invoked by ensureUserProfile on Clerk
-- sign-in so a self-healed row (from the webhook) gets linked to the
-- real Clerk user_id when they arrive.
create or replace function public.link_user_profile_to_clerk(
  p_clerk_user_id text,
  p_email         text,
  p_full_name     text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing user_profiles%rowtype;
  v_result   json;
begin
  if p_email is null or p_email = '' then
    return json_build_object('linked', false, 'reason', 'no email');
  end if;

  -- Look for a pre-existing self-healed row keyed on email.
  select * into v_existing
  from public.user_profiles
  where lower(email) = lower(p_email)
    and (user_id like 'dodo:%' or user_id like 'email:%' or user_id = p_clerk_user_id)
  order by (user_id = p_clerk_user_id) desc,
           (user_id like 'dodo:%')     desc
  limit 1;

  if not found then
    -- No pre-existing row. Insert a fresh one for this Clerk user.
    insert into public.user_profiles (user_id, email, full_name, plan)
    values (p_clerk_user_id, lower(p_email), p_full_name, 'free')
    on conflict (user_id) do nothing;
    return json_build_object('linked', false, 'created', true);
  end if;

  if v_existing.user_id = p_clerk_user_id then
    -- Row already linked to this Clerk user — nothing to do.
    return json_build_object('linked', true, 'already_linked', true);
  end if;

  -- We have a self-healed row (user_id starts with dodo: or email:).
  -- Delete any pre-existing Clerk-user row for this Clerk id to avoid
  -- pk collision, then update the self-healed row's user_id to the
  -- real Clerk id, preserving plan, dodo_customer_id, dates.
  delete from public.user_profiles where user_id = p_clerk_user_id;

  update public.user_profiles
     set user_id       = p_clerk_user_id,
         team_owner_id = p_clerk_user_id,
         full_name     = coalesce(v_existing.full_name, p_full_name)
   where user_id = v_existing.user_id;

  v_result := json_build_object(
    'linked',      true,
    'merged_from', v_existing.user_id,
    'plan',        v_existing.plan
  );
  return v_result;
end;
$$;

revoke execute on function public.link_user_profile_to_clerk(text, text, text) from public;
grant  execute on function public.link_user_profile_to_clerk(text, text, text) to anon, authenticated, service_role;

-- 3. Reconciliation function — finds paid-but-locked users and forces
-- entitlement to catch up. Reads payment_events (source of truth) and
-- writes user_profiles. Idempotent — safe to call every 10 minutes.
create or replace function public.reconcile_paid_but_locked()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fixed  int := 0;
  v_event  record;
  v_email  text;
  v_customer_id text;
begin
  -- Walk every payment.succeeded row where no user_profile is at cue_plus
  for v_event in
    select pe.id, pe.payload
    from public.payment_events pe
    where pe.event_type in ('payment.succeeded', 'subscription.active', 'subscription.renewed')
      and pe.processed_at > (now() - interval '7 days')
  loop
    v_email := lower(coalesce(
      v_event.payload->'data'->'customer'->>'email',
      v_event.payload->'data'->'metadata'->>'email'
    ));
    v_customer_id := coalesce(
      v_event.payload->'data'->'customer'->>'customer_id',
      v_event.payload->'data'->>'customer_id'
    );

    if v_email is null and v_customer_id is null then
      continue;
    end if;

    -- Is anyone at cue_plus for this identifier already? Skip if so.
    if exists (
      select 1 from public.user_profiles
      where (v_email       is not null and lower(email) = v_email)
         or (v_customer_id is not null and dodo_customer_id = v_customer_id)
    ) and exists (
      select 1 from public.user_profiles
      where plan in ('cue_plus', 'cue_plus_team')
        and ((v_email       is not null and lower(email) = v_email)
          or (v_customer_id is not null and dodo_customer_id = v_customer_id))
    ) then
      continue;
    end if;

    -- Grant entitlement via the same anchor the webhook uses.
    insert into public.user_profiles (
      user_id, email, plan, plan_source, plan_started_at,
      team_owner_id, team_seats, dodo_customer_id
    )
    values (
      coalesce('dodo:' || v_customer_id, 'email:' || v_email),
      v_email,
      'cue_plus',
      'reconciliation',
      now(),
      coalesce('dodo:' || v_customer_id, 'email:' || v_email),
      1,
      v_customer_id
    )
    on conflict (user_id) do update
      set plan             = 'cue_plus',
          plan_source      = 'reconciliation',
          plan_started_at  = coalesce(user_profiles.plan_started_at, now()),
          dodo_customer_id = coalesce(user_profiles.dodo_customer_id, excluded.dodo_customer_id);

    v_fixed := v_fixed + 1;
  end loop;

  return json_build_object(
    'fixed_at', now(),
    'count',    v_fixed
  );
end;
$$;

revoke execute on function public.reconcile_paid_but_locked() from public;
revoke execute on function public.reconcile_paid_but_locked() from anon;
revoke execute on function public.reconcile_paid_but_locked() from authenticated;
grant  execute on function public.reconcile_paid_but_locked() to service_role;

-- 4. Auto-fix the current stuck payment ------------------------------
-- Run the reconciliation once, right now, to unlock any user who
-- already paid during the buggy window.
select public.reconcile_paid_but_locked();
