-- Custom pack requests — visual picker on Pricing lets a user select
-- N components with a message; admin follows up with a Dodo payment
-- link at a custom price.
--
-- Anon can insert (email is required); reads are admin-only (service
-- role in edge functions or via the admin dashboard).

create table if not exists custom_pack_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       text,
  email         text not null,
  name          text,
  component_ids text[] not null default '{}',
  message       text,
  status        text not null default 'pending', -- pending | quoted | paid | declined
  admin_note    text,
  quoted_amount_cents integer,
  quoted_currency text,
  quoted_link   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists custom_pack_requests_created_idx
  on custom_pack_requests (created_at desc);

create index if not exists custom_pack_requests_status_idx
  on custom_pack_requests (status, created_at desc);

alter table custom_pack_requests enable row level security;

-- Anyone can insert their own request; nobody reads directly (admin
-- dashboard uses service-role via edge function).
drop policy if exists cpr_anon_insert on custom_pack_requests;
create policy cpr_anon_insert
  on custom_pack_requests
  for insert
  with check (true);

drop policy if exists cpr_no_read on custom_pack_requests;
create policy cpr_no_read
  on custom_pack_requests
  for select
  using (false);
