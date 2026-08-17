-- ============================================================
-- CUE — Admin Inbox SELECT policies (feedback + waitlist_emails)
-- Run once in your Supabase SQL Editor. Safe to re-run.
-- ============================================================
--
-- ⚠️  BETA-ONLY POLICY. Currently allows anon SELECT so the admin
-- page can read submissions with just the anon key. In beta this is
-- acceptable (tables are small, URL not published). Before real launch
-- move both reads behind a Supabase Edge Function verified against the
-- Clerk admin JWT, then re-lock these SELECTs.
-- ============================================================

alter table public.feedback enable row level security;
alter table public.waitlist_emails enable row level security;

drop policy if exists "cue: anon select feedback"       on public.feedback;
drop policy if exists "cue: anon select waitlist"       on public.waitlist_emails;

create policy "cue: anon select feedback"
  on public.feedback for select
  using (true);

create policy "cue: anon select waitlist"
  on public.waitlist_emails for select
  using (true);
