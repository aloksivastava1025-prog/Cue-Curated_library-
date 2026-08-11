-- ============================================================
-- CUE — Add `code` column to prompts table
-- Run this ONCE in your Supabase project's SQL editor.
-- Safe to re-run.
-- ============================================================
--
-- Rationale: the detail view (modal) shows two separate copyable
-- artifacts — the AI PROMPT (how to regenerate/adapt it) and the
-- COMPONENT CODE (the actual production-ready implementation).
-- ============================================================

alter table public.prompts
  add column if not exists code text;
