-- ============================================================
-- CUE — Feedback + Waitlist + Admin Inbox (all-in-one)
-- Run once in your NEW Supabase project's SQL Editor.
-- Safe to re-run — idempotent.
-- ============================================================

-- 1. Feedback table -------------------------------------------------
create table if not exists public.feedback (
  id          bigserial primary key,
  kind        text        not null check (kind in ('improvement', 'component_request', 'other')),
  message     text        not null,
  email       text,
  source      text        default 'homepage-footer',
  referrer    text,
  created_at  timestamptz not null default now()
);
create index if not exists feedback_created_at_idx on public.feedback (created_at desc);
create index if not exists feedback_kind_idx       on public.feedback (kind);

-- 2. Waitlist table -------------------------------------------------
create table if not exists public.waitlist_emails (
  id          bigserial primary key,
  email       text        not null unique,
  source      text        default 'newsletter-hero',
  referrer    text,
  created_at  timestamptz not null default now()
);
create index if not exists waitlist_created_at_idx on public.waitlist_emails (created_at desc);

-- 3. RLS ------------------------------------------------------------
alter table public.feedback         enable row level security;
alter table public.waitlist_emails  enable row level security;

drop policy if exists "cue: anon insert feedback"     on public.feedback;
drop policy if exists "cue: anon select feedback"     on public.feedback;
drop policy if exists "cue: anon insert waitlist"     on public.waitlist_emails;
drop policy if exists "cue: anon select waitlist"     on public.waitlist_emails;

create policy "cue: anon insert feedback"
  on public.feedback for insert with check (true);

create policy "cue: anon select feedback"
  on public.feedback for select using (true);

create policy "cue: anon insert waitlist"
  on public.waitlist_emails for insert with check (true);

create policy "cue: anon select waitlist"
  on public.waitlist_emails for select using (true);

-- ⚠️  BETA-ONLY. anon-open SELECT lets the admin inbox read submissions
-- with just the anon key. Before public launch: move both reads behind
-- a Supabase Edge Function verified against the Clerk admin JWT, then
-- drop these SELECT policies.
