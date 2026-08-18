-- ============================================================
-- CUE — Monthly waitlist (demand signal for $49/mo tier)
-- Fake-door test: capture interest without building subscription infra.
-- ============================================================

create table if not exists public.monthly_waitlist (
  id          bigserial primary key,
  email       text        not null unique,
  source      text        default 'pricing-page',
  referrer    text,
  created_at  timestamptz not null default now()
);

create index if not exists monthly_waitlist_created_at_idx
  on public.monthly_waitlist (created_at desc);

alter table public.monthly_waitlist enable row level security;

drop policy if exists "cue: anon insert monthly waitlist"  on public.monthly_waitlist;
drop policy if exists "cue: admin select monthly waitlist" on public.monthly_waitlist;

-- Anyone can join the waitlist
create policy "cue: anon insert monthly waitlist"
  on public.monthly_waitlist for insert
  with check (true);

-- Only admin can read (locked after lockdown migration; for now permissive)
create policy "cue: admin select monthly waitlist"
  on public.monthly_waitlist for select
  using (true);
