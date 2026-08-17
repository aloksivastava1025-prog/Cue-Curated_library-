-- ============================================================
-- CUE — Social layer: bookmarks (saves), likes, view counts
-- Run once in Supabase SQL Editor. Safe to re-run.
-- ============================================================

-- 1. Counter columns on prompts ------------------------------------
alter table public.prompts add column if not exists view_count int not null default 0;
alter table public.prompts add column if not exists like_count int not null default 0;

-- 2. Bookmarks table -----------------------------------------------
create table if not exists public.prompt_bookmarks (
  user_id     text        not null,      -- Clerk user_id
  prompt_id   text        not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, prompt_id)
);
create index if not exists prompt_bookmarks_user_idx on public.prompt_bookmarks (user_id);

-- 3. Likes table + counter trigger ---------------------------------
create table if not exists public.prompt_likes (
  user_id     text        not null,      -- Clerk user_id
  prompt_id   text        not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, prompt_id)
);
create index if not exists prompt_likes_prompt_idx on public.prompt_likes (prompt_id);

create or replace function public.prompt_likes_sync()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT') then
    update public.prompts set like_count = coalesce(like_count, 0) + 1 where id = new.prompt_id;
    return new;
  elsif (tg_op = 'DELETE') then
    update public.prompts set like_count = greatest(coalesce(like_count, 0) - 1, 0) where id = old.prompt_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists prompt_likes_after_insert on public.prompt_likes;
drop trigger if exists prompt_likes_after_delete on public.prompt_likes;

create trigger prompt_likes_after_insert
  after insert on public.prompt_likes
  for each row execute function public.prompt_likes_sync();

create trigger prompt_likes_after_delete
  after delete on public.prompt_likes
  for each row execute function public.prompt_likes_sync();

-- 4. View increment function (callable via RPC) --------------------
create or replace function public.increment_view(pid text)
returns void language sql security definer as $$
  update public.prompts set view_count = coalesce(view_count, 0) + 1 where id = pid;
$$;
grant execute on function public.increment_view(text) to anon, authenticated;

-- 5. RLS ------------------------------------------------------------
alter table public.prompt_bookmarks enable row level security;
alter table public.prompt_likes     enable row level security;

drop policy if exists "cue: read bookmarks"        on public.prompt_bookmarks;
drop policy if exists "cue: insert bookmarks"      on public.prompt_bookmarks;
drop policy if exists "cue: delete bookmarks"      on public.prompt_bookmarks;
drop policy if exists "cue: read likes"            on public.prompt_likes;
drop policy if exists "cue: insert likes"          on public.prompt_likes;
drop policy if exists "cue: delete likes"          on public.prompt_likes;

-- Beta permissive: client provides user_id (from Clerk) and self-scopes.
-- Tighten via edge function + Clerk JWT verify before public launch.
create policy "cue: read bookmarks"   on public.prompt_bookmarks for select using (true);
create policy "cue: insert bookmarks" on public.prompt_bookmarks for insert with check (true);
create policy "cue: delete bookmarks" on public.prompt_bookmarks for delete using (true);

create policy "cue: read likes"       on public.prompt_likes for select using (true);
create policy "cue: insert likes"     on public.prompt_likes for insert with check (true);
create policy "cue: delete likes"     on public.prompt_likes for delete using (true);
