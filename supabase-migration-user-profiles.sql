-- ============================================================
-- CUE — user_profiles (Clerk ↔ Supabase link, entitlements)
-- Run once in Supabase SQL Editor. Safe to re-run.
-- ============================================================
-- Populated by a Clerk webhook on signup (to be wired later).
-- Payment webhook (Dodo) will update `plan` + `plan_expires_at`.
-- ============================================================

create table if not exists public.user_profiles (
  user_id           text        primary key,          -- Clerk user_id
  email             text        not null,
  full_name         text,
  plan              text        not null default 'free' check (plan in ('free', 'cue_plus', 'cue_plus_team')),
  plan_source       text,                             -- 'dodo' | 'manual' | 'grant'
  plan_started_at   timestamptz,
  plan_expires_at   timestamptz,                      -- null = lifetime
  team_owner_id     text,                             -- Clerk user_id of team plan owner (self for solo)
  team_seats        int not null default 1,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists user_profiles_email_idx  on public.user_profiles (email);
create index if not exists user_profiles_plan_idx   on public.user_profiles (plan);
create index if not exists user_profiles_team_idx   on public.user_profiles (team_owner_id);

-- keep updated_at fresh
create or replace function public.user_profiles_touch()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists user_profiles_touch on public.user_profiles;
create trigger user_profiles_touch
  before update on public.user_profiles
  for each row execute function public.user_profiles_touch();

alter table public.user_profiles enable row level security;

drop policy if exists "cue: read own profile"       on public.user_profiles;
drop policy if exists "cue: upsert own profile"     on public.user_profiles;

-- Beta permissive — client scopes by its Clerk user_id. Locked down via
-- edge function + JWT verify before public launch.
create policy "cue: read own profile"
  on public.user_profiles for select using (true);

create policy "cue: upsert own profile"
  on public.user_profiles for insert with check (true);
