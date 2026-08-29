-- Hire requests — project briefs from the "Hire me" CTA on the
-- home hero. Same access pattern as custom_pack_requests: anon
-- inserts, no direct reads (admin uses an edge function with the
-- service role).

create table if not exists hire_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       text,
  name          text not null,
  contact       text not null,
  contact_type  text not null default 'email',   -- email | x_handle
  project_desc  text not null,
  site_type     text not null default 'landing',
  budget        text not null default 'flexible',
  timeline      text not null default 'normal',
  message       text,
  status        text not null default 'new',     -- new | qualified | quoted | booked | declined
  admin_note    text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists hire_requests_created_idx
  on hire_requests (created_at desc);

create index if not exists hire_requests_status_idx
  on hire_requests (status, created_at desc);

alter table hire_requests enable row level security;

drop policy if exists hr_anon_insert on hire_requests;
create policy hr_anon_insert on hire_requests
  for insert with check (true);

drop policy if exists hr_no_read on hire_requests;
create policy hr_no_read on hire_requests
  for select using (false);
