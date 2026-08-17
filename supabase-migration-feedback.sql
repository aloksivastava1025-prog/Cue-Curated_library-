-- ============================================================
-- CUE — Feedback / component request table
-- Run once in your NEW Supabase project's SQL Editor.
-- Safe to re-run.
-- ============================================================

create table if not exists public.feedback (
  id          bigserial primary key,
  kind        text        not null check (kind in ('improvement', 'component_request', 'other')),
  message     text        not null,
  email       text,
  source      text        default 'homepage-footer',
  referrer    text,
  created_at  timestamptz not null default now()
);

create index if not exists feedback_created_at_idx
  on public.feedback (created_at desc);
create index if not exists feedback_kind_idx
  on public.feedback (kind);

-- RLS: anon can INSERT; no read/update/delete from the frontend
alter table public.feedback enable row level security;

drop policy if exists "cue: anon insert feedback" on public.feedback;
create policy "cue: anon insert feedback"
  on public.feedback for insert
  with check (true);
