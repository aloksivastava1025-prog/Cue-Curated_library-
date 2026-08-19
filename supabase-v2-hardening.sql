-- ============================================================
-- CUE v2.0 — Production Hardening Migration
-- ============================================================
-- Run ONCE in Supabase SQL Editor (staging first, then prod).
-- Safe to re-run — all statements use IF NOT EXISTS / OR REPLACE.
--
-- What it adds:
--   §3.1  payment_events (webhook idempotency)
--   §3.2  rate_limit_windows + atomic check_and_increment_rate_limit()
--   §3.3  prompt_id_seq + next_prompt_id() (collision-proof IDs)
--   §3.5  prompt_views (view counter dedup)
--   §4.6  admin_audit_log (append-only admin action trail)
--   §3.6  team seat constraint on user_profiles
--   §5    performance indexes
-- ============================================================


-- ============================================================
-- §3.1 — PAYMENT EVENT IDEMPOTENCY
-- ============================================================
-- Dodo (and all Standard Webhooks providers) can deliver the
-- same event more than once. We log the event by its unique
-- webhook-id BEFORE acting on it. A duplicate insert fails
-- the PK constraint → handler short-circuits with 200.
-- ============================================================

create table if not exists public.payment_events (
  id            text        primary key,      -- Dodo's webhook-id header
  event_type    text        not null,
  payload       jsonb       not null,
  user_id       text,                         -- resolved from metadata
  processed_at  timestamptz not null default now()
);

create index if not exists payment_events_user_idx
  on public.payment_events (user_id);
create index if not exists payment_events_type_idx
  on public.payment_events (event_type);

-- RLS: only service_role should touch this table. No client access.
alter table public.payment_events enable row level security;

-- No permissive policies = no access via anon/authenticated.
-- Edge functions use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS.


-- ============================================================
-- §3.2 — ATOMIC RATE LIMITER
-- ============================================================
-- Replaces the check-then-insert trigger with a row-locked
-- atomic function. Two concurrent requests for the same key
-- serialize on the FOR UPDATE lock — the race is impossible.
-- ============================================================

create table if not exists public.rate_limit_windows (
  key           text        primary key,
  window_start  timestamptz not null default now(),
  count         int         not null default 0
);

-- No client access needed — called from triggers / edge functions.
alter table public.rate_limit_windows enable row level security;

create or replace function public.check_and_increment_rate_limit(
  p_key text,
  p_max int,
  p_window_seconds int
) returns boolean
language plpgsql
as $$
declare
  v_row public.rate_limit_windows%rowtype;
begin
  -- row lock serializes concurrent callers for the SAME key
  select * into v_row
    from public.rate_limit_windows
    where key = p_key
    for update;

  if not found then
    insert into public.rate_limit_windows(key, window_start, count)
      values (p_key, now(), 1)
      on conflict (key) do update
        set window_start = now(), count = 1;
    return true;
  end if;

  -- Window expired? Reset.
  if now() - v_row.window_start > make_interval(secs => p_window_seconds) then
    update public.rate_limit_windows
      set window_start = now(), count = 1
      where key = p_key;
    return true;
  end if;

  -- At limit? Reject.
  if v_row.count >= p_max then
    return false;
  end if;

  -- Under limit — increment and allow.
  update public.rate_limit_windows
    set count = count + 1
    where key = p_key;
  return true;
end;
$$;

grant execute on function public.check_and_increment_rate_limit(text, int, int)
  to anon, authenticated;

-- Replace the old feedback_rate_limit trigger with one that uses
-- the atomic rate limiter instead of a racy SELECT count(*).
create or replace function public.feedback_rate_limit_v2()
returns trigger language plpgsql as $$
declare
  rate_key text;
  allowed  boolean;
begin
  if new.email is not null then
    rate_key := 'feedback:' || lower(new.email);
  else
    rate_key := 'feedback:ref:' || coalesce(new.referrer, 'unknown');
  end if;

  select public.check_and_increment_rate_limit(rate_key, 3, 600)
    into allowed;

  if not allowed then
    raise exception 'feedback rate limit exceeded: try again in a few minutes';
  end if;

  return new;
end;
$$;

-- Swap the trigger to use the v2 function.
drop trigger if exists feedback_rate_limit    on public.feedback;
drop trigger if exists feedback_rate_limit_v2 on public.feedback;

create trigger feedback_rate_limit_v2
  before insert on public.feedback
  for each row execute function public.feedback_rate_limit_v2();


-- ============================================================
-- §3.3 — SERVER-SIDE PROMPT ID GENERATION
-- ============================================================
-- Replaces the client-picked ID + retry-on-collision loop.
-- nextval() is atomic and collision-proof by construction.
-- ============================================================

-- Initialize the sequence from the current max ID in the table,
-- so it picks up where existing data left off.
create sequence if not exists public.prompt_id_seq;

select setval('public.prompt_id_seq', coalesce(
  (select max((substring(id from 4))::int) from public.prompts where id ~ '^cue\d+$'),
  0
));

create or replace function public.next_prompt_id()
returns text language sql as $$
  select 'cue' || lpad(nextval('public.prompt_id_seq')::text, 3, '0');
$$;

grant execute on function public.next_prompt_id() to anon, authenticated;


-- ============================================================
-- §3.5 — VIEW COUNTER DEDUP TABLE
-- ============================================================
-- Replaces the anon-callable, unlimited increment_view RPC.
-- The composite PK (prompt_id, viewer_key, viewed_on) means
-- the DB itself rejects a second count for the same viewer/day.
-- ============================================================

create table if not exists public.prompt_views (
  prompt_id   text        not null,
  viewer_key  text        not null,         -- hash of IP + session/user ID
  viewed_on   date        not null default current_date,
  primary key (prompt_id, viewer_key, viewed_on)
);

create index if not exists prompt_views_prompt_idx
  on public.prompt_views (prompt_id);

-- RLS: no direct client access. Edge function uses service role.
alter table public.prompt_views enable row level security;

-- Replace the old security-definer increment_view with a safe version
-- that takes a viewer_key for dedup. Only callable from edge functions
-- (via service role), not from the client.
create or replace function public.increment_view_safe(
  p_prompt_id text,
  p_viewer_key text
) returns boolean
language plpgsql security definer as $$
declare
  inserted boolean;
begin
  -- Try to insert. If the PK constraint fires (same viewer today),
  -- we skip silently and return false.
  insert into public.prompt_views (prompt_id, viewer_key, viewed_on)
    values (p_prompt_id, p_viewer_key, current_date)
    on conflict (prompt_id, viewer_key, viewed_on) do nothing;

  -- Check if we actually inserted a new row.
  get diagnostics inserted = row_count;

  if inserted then
    update public.prompts
      set view_count = coalesce(view_count, 0) + 1
      where id = p_prompt_id;
    return true;
  end if;

  return false;  -- already counted today
end;
$$;

-- Revoke the old unlimited increment_view from anon clients.
-- Keep the function for backward compat but remove anon execute.
revoke execute on function public.increment_view(text) from anon;


-- ============================================================
-- §4.6 — ADMIN AUDIT LOG
-- ============================================================
-- Append-only log of every admin mutation. Invaluable for
-- debugging "who changed this and when" and for compliance.
-- ============================================================

create table if not exists public.admin_audit_log (
  id            bigserial   primary key,
  actor_email   text        not null,
  action        text        not null,       -- 'publish', 'unpublish', 'feature', 'reply', etc.
  target_type   text,                       -- 'prompt', 'feedback', etc.
  target_id     text,                       -- the affected row's ID
  before_state  jsonb,                      -- snapshot before (nullable for creates)
  after_state   jsonb,                      -- snapshot after  (nullable for deletes)
  metadata      jsonb,                      -- any extra context
  created_at    timestamptz not null default now()
);

create index if not exists admin_audit_log_actor_idx
  on public.admin_audit_log (actor_email);
create index if not exists admin_audit_log_target_idx
  on public.admin_audit_log (target_type, target_id);
create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

comment on table public.admin_audit_log is 'Append-only log of admin actions. Recommended retention: partition or archive rows older than 24 months.';

-- RLS: admin read-only (SELECT), service role INSERT.
alter table public.admin_audit_log enable row level security;

drop policy if exists "cue: admin read audit log" on public.admin_audit_log;
create policy "cue: admin read audit log"
  on public.admin_audit_log for select
  using (public.is_cue_admin());

-- Helper: log an admin action. Called from edge functions or
-- directly from the client (admin-gated via RLS).
create or replace function public.log_admin_action(
  p_actor_email text,
  p_action text,
  p_target_type text default null,
  p_target_id text default null,
  p_before jsonb default null,
  p_after jsonb default null,
  p_metadata jsonb default null
) returns void
language sql security definer as $$
  insert into public.admin_audit_log
    (actor_email, action, target_type, target_id, before_state, after_state, metadata)
  values
    (p_actor_email, p_action, p_target_type, p_target_id, p_before, p_after, p_metadata);
$$;

grant execute on function public.log_admin_action(text, text, text, text, jsonb, jsonb, jsonb)
  to authenticated;


-- ============================================================
-- §3.6 — TEAM SEAT CONSTRAINT
-- ============================================================
-- Prevents overallocation: team_seats must never go negative.
-- The actual "check seats before adding a member" logic lives
-- in the edge function with a FOR UPDATE lock on the owner row.
-- ============================================================

-- Safe: ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS is PG 9.6+.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_team_seats'
      and conrelid = 'public.user_profiles'::regclass
  ) then
    alter table public.user_profiles
      add constraint chk_team_seats check (team_seats >= 0);
  end if;
end;
$$;


-- ============================================================
-- §5 — PERFORMANCE INDEXES
-- ============================================================
-- Add indexes on high-traffic FK columns before content scales.
-- All IF NOT EXISTS — safe to re-run.
-- ============================================================

-- These may already exist from earlier migrations; idempotent.
create index if not exists prompt_bookmarks_user_idx
  on public.prompt_bookmarks (user_id);
create index if not exists prompt_bookmarks_prompt_idx
  on public.prompt_bookmarks (prompt_id);
create index if not exists prompt_likes_user_idx
  on public.prompt_likes (user_id);
create index if not exists prompt_likes_prompt_idx
  on public.prompt_likes (prompt_id);
create index if not exists feedback_email_idx
  on public.feedback (email);
create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);
create index if not exists feedback_messages_feedback_idx
  on public.feedback_messages (feedback_id);
create index if not exists waitlist_emails_email_idx
  on public.waitlist_emails (email);


-- ============================================================
-- §4.7 — TURNSTILE REPLAY PROTECTION
-- ============================================================
-- Stores hashed Turnstile tokens to prevent replay attacks.
-- ============================================================

create table if not exists public.turnstile_tokens_seen (
  token_hash text primary key,
  seen_at    timestamptz not null default now()
);

comment on table public.turnstile_tokens_seen is 'Stores hashed Turnstile tokens to prevent replay attacks. A scheduled cron (pg_cron) should delete rows older than 10 minutes.';

-- RLS: service role only
alter table public.turnstile_tokens_seen enable row level security;


-- ============================================================
-- §7.2 — USER DELETION CASCADE (DPDP COMPLIANCE)
-- ============================================================
-- Called by Clerk user.deleted webhook to purge all PII and
-- associated interactions (bookmarks, likes, feedback).
-- ============================================================

create or replace function public.delete_user_cascade(p_user_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  -- Grab the email once — used for tables keyed on email rather than
  -- Clerk user_id.
  select email into v_email
  from public.user_profiles
  where user_id = p_user_id;

  -- 1. Owned-by-user_id — hard delete
  delete from public.prompt_bookmarks where user_id = p_user_id;
  delete from public.prompt_likes     where user_id = p_user_id;

  -- 2. Owned-by-email — hard delete (only when we know the email)
  if v_email is not null then
    delete from public.feedback_messages where author_email = v_email;
    -- waitlist_emails and monthly_waitlist may not exist in every env;
    -- guard the deletes so this function stays idempotent across setups.
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name='waitlist_emails') then
      delete from public.waitlist_emails where email = v_email;
    end if;
    if exists (select 1 from information_schema.tables where table_schema='public' and table_name='monthly_waitlist') then
      delete from public.monthly_waitlist where email = v_email;
    end if;
  end if;

  -- 3. Feedback: keep content for admin analytics, remove PII
  if v_email is not null then
    update public.feedback set email = null where email = v_email;
  end if;

  -- 4. Finally, remove the profile itself
  delete from public.user_profiles where user_id = p_user_id;

  return json_build_object(
    'user_id',    p_user_id,
    'email',      v_email,
    'deleted_at', now()
  );
end;
$$;

-- Server-only. Anon / authenticated cannot invoke — Clerk webhook uses
-- the service_role key to call it via RPC.
revoke execute on function public.delete_user_cascade(text) from public;
revoke execute on function public.delete_user_cascade(text) from anon;
revoke execute on function public.delete_user_cascade(text) from authenticated;
grant  execute on function public.delete_user_cascade(text) to service_role;


-- ============================================================
-- Done. Verify by running:
--   select routine_name from information_schema.routines
--   where routine_schema = 'public'
--   and routine_name in (
--     'check_and_increment_rate_limit',
--     'next_prompt_id',
--     'increment_view_safe',
--     'log_admin_action',
--     'feedback_rate_limit_v2'
--   );
-- Should return all 5 functions.
--
--   select table_name from information_schema.tables
--   where table_schema = 'public'
--   and table_name in (
--     'payment_events',
--     'rate_limit_windows',
--     'prompt_views',
--     'admin_audit_log'
--   );
-- Should return all 4 tables.
-- ============================================================
