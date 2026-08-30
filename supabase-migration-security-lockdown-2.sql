-- ============================================================
-- Cue — Security lockdown v2 (pre-launch audit fixes)
-- ============================================================
-- Fixes from the Aug 2026 security audit. Each block corresponds
-- to a finding — see comments for finding # and rationale.
-- ============================================================

-- ------------------------------------------------------------
-- #1 CRITICAL — prompt_contents was fully public-select
-- ------------------------------------------------------------
-- Requires a Clerk→Supabase JWT bridge (auth.jwt()->>'sub') that
-- Cue does not have wired yet. Applying this migration without
-- the bridge would break paying users' access to prompt text on
-- the modal.
--
-- Plan: (a) ship a `get-prompt-content` edge function that
-- verifies the Clerk JWT and reads via service-role, (b) refactor
-- backend.getPromptContent to call it, (c) then flip on the
-- policy below.
--
-- To activate: uncomment the DROP + CREATE and deploy.
-- ------------------------------------------------------------
-- drop policy if exists "cue: public read prompt_content" on public.prompt_contents;
--
-- create policy "cue: paying read prompt_content"
--   on public.prompt_contents for select
--   using (
--     coalesce(public.is_cue_admin(), false)
--     or exists (
--       select 1
--       from public.user_profiles up
--       where up.user_id = auth.jwt() ->> 'sub'
--         and up.plan in ('cue_plus', 'cue_plus_team')
--         and (up.plan_expires_at is null or up.plan_expires_at > now())
--     )
--   );

-- ------------------------------------------------------------
-- #4 HIGH — user_profiles self-insert plan constraint
-- #11 MED — feedback_messages read lockdown
-- ------------------------------------------------------------
-- Both blocks require the Clerk→Supabase JWT bridge (see #1
-- comment). Ship the bridge first, then flip these on.
-- ------------------------------------------------------------
-- (deferred — see #1)

-- ------------------------------------------------------------
-- Rate-limit windows for edge-fn abuse (hire-notify, custom-
-- pack-notify, autofill-metadata, upload-to-r2). rate_limit_
-- windows table pre-exists — this block only ensures the row
-- shape is what edge functions expect.
-- ------------------------------------------------------------
create table if not exists public.rate_limit_windows (
  key         text primary key,
  count       integer not null default 0,
  reset_at    timestamptz not null
);

alter table public.rate_limit_windows enable row level security;
-- Only service-role touches this table; deny all anon RLS.
drop policy if exists "cue: rl_no_read" on public.rate_limit_windows;
create policy "cue: rl_no_read" on public.rate_limit_windows for select using (false);
drop policy if exists "cue: rl_no_write" on public.rate_limit_windows;
create policy "cue: rl_no_write" on public.rate_limit_windows for insert with check (false);
