-- ============================================================
-- CUE — Full Supabase setup (schema + migrations + RLS + storage)
-- ============================================================
-- Run this ONCE in your NEW Supabase project's SQL Editor.
-- Safe to re-run (all statements use IF NOT EXISTS / IF EXISTS
-- and the RLS policies drop-and-recreate).
--
-- What it does:
--   1. Creates the `prompts` and `prompt_contents` tables
--   2. Adds all the new columns (tags, description, code, use_case,
--      component_type)
--   3. Enables Row-Level Security so anon users can read + write
--      (fine for local testing; tighten later for production)
--   4. Creates the `cue-media` storage bucket + upload policies
-- ============================================================


-- ============================================================
-- 1. TABLES
-- ============================================================

create table if not exists public.prompts (
  id          text        primary key,
  title       text        not null,
  category    text        not null,
  section     text        not null default 'general',
  tier        text        not null default 'free' check (tier in ('free','premium')),
  rail        text        check (rail in ('featured','fresh','trending')),
  brand       text        not null default 'cue',
  variant     text        not null default 'sans',
  stack       jsonb       not null default '[]'::jsonb,
  thumb_src   text,
  hover_src   text,
  prompt      text,
  status      text        not null default 'published' check (status in ('published', 'draft')),
  created_at  timestamptz not null default now()
);

create index if not exists prompts_section_idx    on public.prompts (section);
create index if not exists prompts_tier_idx       on public.prompts (tier);
create index if not exists prompts_status_idx     on public.prompts (status);
create index if not exists prompts_created_at_idx on public.prompts (created_at desc);

-- Separate table for prompt content — allows locking down the actual
-- prompt text under RLS separately from the metadata.
create table if not exists public.prompt_contents (
  prompt_id text primary key references public.prompts(id) on delete cascade,
  content   text not null,
  updated_at timestamptz not null default now()
);


-- ============================================================
-- 2. NEW COLUMNS (from the four migration files)
-- ============================================================

alter table public.prompts
  add column if not exists tags        jsonb not null default '[]'::jsonb,
  add column if not exists description text,
  add column if not exists code        text,
  add column if not exists use_case    text,
  add column if not exists component_type text
    check (component_type is null or component_type in ('section', 'interaction'));

create index if not exists prompts_tags_idx on public.prompts using gin (tags);


-- ============================================================
-- 3. ROW-LEVEL SECURITY (RLS)
-- ============================================================
-- Enable RLS on both tables, then create permissive policies so:
--   * anyone (anon) can READ everything on the frontend
--   * anyone (anon) can INSERT/UPDATE/DELETE — this is deliberately
--     open for local testing while you build the admin panel.
--     Tighten this later (e.g. limit writes to a specific user_id)
--     before shipping to real users.
--
-- Re-runnable: drop-then-create.
-- ============================================================

alter table public.prompts         enable row level security;
alter table public.prompt_contents enable row level security;

drop policy if exists "cue: anon read prompts"       on public.prompts;
drop policy if exists "cue: anon write prompts"      on public.prompts;
drop policy if exists "cue: anon read prompt_content" on public.prompt_contents;
drop policy if exists "cue: anon write prompt_content" on public.prompt_contents;

create policy "cue: anon read prompts"
  on public.prompts for select
  using (true);

create policy "cue: anon write prompts"
  on public.prompts for all
  using (true)
  with check (true);

create policy "cue: anon read prompt_content"
  on public.prompt_contents for select
  using (true);

create policy "cue: anon write prompt_content"
  on public.prompt_contents for all
  using (true)
  with check (true);


-- ============================================================
-- 4. STORAGE BUCKET — `cue-media` (for thumbnails + hover videos)
-- ============================================================
-- Public bucket so image/video URLs work without signed URLs.
-- Upload allowed for anyone (matches the open write policy above).
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit)
  values ('cue-media', 'cue-media', true, 26214400) -- 25 MB per file
  on conflict (id) do update
    set public = excluded.public,
        file_size_limit = excluded.file_size_limit;

drop policy if exists "cue: read cue-media"   on storage.objects;
drop policy if exists "cue: upload cue-media" on storage.objects;
drop policy if exists "cue: update cue-media" on storage.objects;
drop policy if exists "cue: delete cue-media" on storage.objects;

create policy "cue: read cue-media"
  on storage.objects for select
  using (bucket_id = 'cue-media');

create policy "cue: upload cue-media"
  on storage.objects for insert
  with check (bucket_id = 'cue-media');

create policy "cue: update cue-media"
  on storage.objects for update
  using (bucket_id = 'cue-media')
  with check (bucket_id = 'cue-media');

create policy "cue: delete cue-media"
  on storage.objects for delete
  using (bucket_id = 'cue-media');


-- ============================================================
-- Done. Verify by running:
--   select table_name, column_name from information_schema.columns
--   where table_schema = 'public' and table_name = 'prompts'
--   order by ordinal_position;
-- You should see: id, title, category, section, tier, rail, brand,
-- variant, stack, thumb_src, hover_src, prompt, status, created_at,
-- tags, description, code, use_case, component_type
-- ============================================================
