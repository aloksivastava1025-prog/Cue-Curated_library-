-- ============================================================
-- CUE — Add `component_type` column to prompts table
-- Run this ONCE in your Supabase project's SQL editor.
-- Safe to re-run.
-- ============================================================
--
-- Purpose: Explicitly categorize each item as either a
--   * 'section'     — self-contained page piece (hero, nav, form,
--                     gallery, footer, pricing block, CTA row, etc.)
--   * 'interaction' — smaller effect / animation / behavior
--                     (button hover, cursor effect, scroll reveal,
--                     text animation, 3D toy, etc.)
--
-- Powers the All / Sections / Interactions toggle on the homepage.
-- Editable by the admin; the AI autofill suggests a value.
-- ============================================================

alter table public.prompts
  add column if not exists component_type text
    check (component_type is null or component_type in ('section', 'interaction'));
