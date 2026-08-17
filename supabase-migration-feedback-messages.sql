-- ============================================================
-- CUE — Feedback replies / two-way threading
-- Run once in your Supabase SQL Editor. Safe to re-run.
-- ============================================================
-- Each feedback row is the root of a thread. Replies are stored
-- in `feedback_messages` as children. Author is 'admin' or 'user'.
-- ============================================================

create table if not exists public.feedback_messages (
  id            bigserial primary key,
  feedback_id   bigint      not null references public.feedback(id) on delete cascade,
  body          text        not null,
  author        text        not null check (author in ('admin', 'user')),
  author_email  text,
  created_at    timestamptz not null default now()
);

create index if not exists feedback_messages_feedback_idx
  on public.feedback_messages (feedback_id, created_at);
create index if not exists feedback_messages_email_idx
  on public.feedback_messages (author_email);

alter table public.feedback_messages enable row level security;

drop policy if exists "cue: anon insert message"  on public.feedback_messages;
drop policy if exists "cue: anon select messages" on public.feedback_messages;

-- BETA policies: permissive. Same trade-off as feedback SELECT policy.
-- Tighten via edge function + Clerk verification before public launch.
create policy "cue: anon insert message"
  on public.feedback_messages for insert
  with check (
    author in ('admin', 'user')
    and length(body) between 1 and 4000
  );

create policy "cue: anon select messages"
  on public.feedback_messages for select
  using (true);
