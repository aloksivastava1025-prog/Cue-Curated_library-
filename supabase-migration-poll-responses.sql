-- Founding-blocker poll — captures what would convert an engaged
-- anonymous visitor into a Cue+ founding member. Rows are anonymous
-- (no user_id) since the whole point is to hear from people who
-- haven't signed up yet.
create table if not exists poll_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id text not null default 'founding-blocker-v1',
  choice text not null,
  free_text text,
  session_id text,
  page_path text,
  seconds_on_site int,
  ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists poll_responses_poll_created
  on poll_responses (poll_id, created_at desc);

-- Anon inserts allowed (Cue is unauthenticated when this fires).
-- No reads for anon — admin queries via service role in the
-- Supabase dashboard.
alter table poll_responses enable row level security;

drop policy if exists "anon can submit poll" on poll_responses;
create policy "anon can submit poll" on poll_responses
  for insert to anon
  with check (
    choice is not null
    and length(choice) <= 40
    and (free_text is null or length(free_text) <= 500)
  );
