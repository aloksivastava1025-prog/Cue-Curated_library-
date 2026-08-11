-- ============================================================
-- CUE — Add tags + description columns to prompts
-- Run this ONCE in your Supabase project's SQL editor.
-- Safe to re-run (uses IF NOT EXISTS).
-- ============================================================

alter table public.prompts
  add column if not exists tags        jsonb not null default '[]'::jsonb,
  add column if not exists description text;

-- Optional: index for tag filtering later (cheap, useful once you have volume)
create index if not exists prompts_tags_idx on public.prompts using gin (tags);
