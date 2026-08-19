-- ============================================================
-- CUE — user_profiles onboarding columns
-- Adds display_name, avatar_url, onboarded_at.
-- Safe to re-run.
-- ============================================================

alter table public.user_profiles
  add column if not exists display_name  text,
  add column if not exists avatar_url    text,
  add column if not exists onboarded_at  timestamptz;

-- Unique display_name (case-insensitive) — prevents duplicates on
-- the onboarding step. Nulls allowed for users who haven't onboarded.
create unique index if not exists user_profiles_display_name_lower_uniq
  on public.user_profiles (lower(display_name))
  where display_name is not null;
