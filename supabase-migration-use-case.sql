-- ============================================================
-- CUE — Add `use_case` column to prompts table
-- Run this ONCE in your Supabase project's SQL editor.
-- Safe to re-run.
-- ============================================================
--
-- Purpose: AI + admin annotate each item with where it is best
-- used ("Perfect for editorial hero sections on agency portfolios",
-- "Ideal as a section divider in long-form articles", etc.).
-- Shown to end-users in the detail modal so they can quickly
-- judge whether the component fits their project.
-- ============================================================

alter table public.prompts
  add column if not exists use_case text;
