-- ============================================================
-- CUE — Waitlist table (beta signup)
-- Run once in your NEW Supabase project's SQL Editor.
-- Safe to re-run.
-- ============================================================

create table if not exists public.waitlist_emails (
  id          bigserial primary key,
  email       text        not null,
  source      text        default 'homepage-hero',
  referrer    text,
  created_at  timestamptz not null default now(),
  -- Simple uniqueness so re-signups don't create dupes.
  constraint waitlist_emails_email_unique unique (email)
);

create index if not exists waitlist_emails_created_at_idx
  on public.waitlist_emails (created_at desc);

-- RLS: anon can INSERT (public sign-up), no SELECT/UPDATE/DELETE from client
alter table public.waitlist_emails enable row level security;

drop policy if exists "cue: anon insert waitlist" on public.waitlist_emails;
drop policy if exists "cue: anon read waitlist"   on public.waitlist_emails;

create policy "cue: anon insert waitlist"
  on public.waitlist_emails for insert
  with check (true);

-- Admin dashboards can read via service_role key (bypasses RLS). If you
-- want authenticated admin emails to read from the frontend, add a
-- targeted policy that checks auth.jwt() -> email in your admin list.
