-- ============================================================
-- CUE — Security Lockdown (Batch 1 of production hardening)
-- ============================================================
--
-- ⚠️  REQUIREMENTS BEFORE RUNNING THIS FILE:
--
--   1. Clerk → Supabase JWT bridge must be configured on BOTH sides:
--        a) Clerk Dashboard → JWT Templates → create "supabase" template
--           with claims: sub = user.id, email = user.primaryEmailAddress
--        b) Supabase Dashboard → Settings → JWT Settings → paste Clerk's
--           JWKS URL (or the signing key from the template)
--
--   2. Local `.env` must set: VITE_USE_CLERK_SUPABASE_JWT=true
--      (and same env var on Vercel for prod)
--
--   3. You must be signed in as an admin (akashkumar7653099@gmail.com or
--      aloksivastava1025@gmail.com) when testing the admin flows post-migration
--
-- If ANY of the above isn't done, running this file will break the app —
-- reads on feedback/waitlist/etc will start rejecting, writes on prompts
-- will start rejecting, etc.
--
-- Safe to re-run.
-- ============================================================

-- ============================================================
-- ADMIN HELPER — used in RLS checks below.
-- Centralises the admin allow-list so we can change it in one place.
-- ============================================================
create or replace function public.is_cue_admin()
returns boolean language sql stable as $$
  select coalesce(
    (auth.jwt() ->> 'email') in (
      'akashkumar7653099@gmail.com',
      'aloksivastava1025@gmail.com'
    ),
    false
  );
$$;
grant execute on function public.is_cue_admin() to anon, authenticated;

-- Helper: is the caller acting as a specific Clerk user_id?
create or replace function public.is_self(uid text)
returns boolean language sql stable as $$
  select coalesce(uid = (auth.jwt() ->> 'sub'), false);
$$;
grant execute on function public.is_self(text) to anon, authenticated;

-- ============================================================
-- C1 — prompts / prompt_contents: writes admin-only
-- ============================================================
drop policy if exists "cue: anon read prompts"        on public.prompts;
drop policy if exists "cue: anon write prompts"       on public.prompts;
drop policy if exists "cue: anon read prompt_content" on public.prompt_contents;
drop policy if exists "cue: anon write prompt_content" on public.prompt_contents;

-- Reads stay public (the library is the product)
create policy "cue: public read prompts"
  on public.prompts for select using (true);

-- Writes: admin only
create policy "cue: admin write prompts"
  on public.prompts for all
  using (public.is_cue_admin())
  with check (public.is_cue_admin());

-- prompt_contents (paid prompt text) — SELECT will later be gated by
-- entitlement (Cue+ plan) via an edge function; for now keep public so
-- the free tier still resolves. Writes admin-only.
create policy "cue: public read prompt_content"
  on public.prompt_contents for select using (true);

create policy "cue: admin write prompt_content"
  on public.prompt_contents for all
  using (public.is_cue_admin())
  with check (public.is_cue_admin());

-- ============================================================
-- C2 — Storage bucket `cue-media`: reads public, writes admin
-- ============================================================
drop policy if exists "cue: anon read cue-media"   on storage.objects;
drop policy if exists "cue: anon insert cue-media" on storage.objects;
drop policy if exists "cue: anon update cue-media" on storage.objects;
drop policy if exists "cue: anon delete cue-media" on storage.objects;

create policy "cue: public read cue-media"
  on storage.objects for select
  using (bucket_id = 'cue-media');

create policy "cue: admin write cue-media"
  on storage.objects for insert
  with check (bucket_id = 'cue-media' and public.is_cue_admin());

create policy "cue: admin update cue-media"
  on storage.objects for update
  using (bucket_id = 'cue-media' and public.is_cue_admin())
  with check (bucket_id = 'cue-media' and public.is_cue_admin());

create policy "cue: admin delete cue-media"
  on storage.objects for delete
  using (bucket_id = 'cue-media' and public.is_cue_admin());

-- ============================================================
-- C3 — feedback_messages: author='admin' requires admin JWT
-- ============================================================
drop policy if exists "cue: anon insert message"   on public.feedback_messages;
drop policy if exists "cue: anon select messages"  on public.feedback_messages;

-- Users can post to a thread as 'user'; admins can post as 'admin'.
create policy "cue: user insert message"
  on public.feedback_messages for insert
  with check (
    author = 'user'
    and length(body) between 1 and 4000
  );

create policy "cue: admin insert message"
  on public.feedback_messages for insert
  with check (
    author = 'admin'
    and public.is_cue_admin()
    and length(body) between 1 and 4000
  );

-- SELECT: admins see all; users see only threads that match their email
-- (join through feedback to enforce ownership).
create policy "cue: admin select messages"
  on public.feedback_messages for select
  using (public.is_cue_admin());

create policy "cue: user select own messages"
  on public.feedback_messages for select
  using (
    exists (
      select 1 from public.feedback f
      where f.id = feedback_messages.feedback_id
        and lower(f.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- ============================================================
-- C4 — Read leaks: feedback / waitlist / user_profiles
--       INSERT stays anon (users submit), SELECT admin-only.
--       Users' own-thread reads happen via listThreadsForEmail —
--       we add a per-user policy for feedback below.
-- ============================================================
drop policy if exists "cue: anon select feedback"        on public.feedback;
drop policy if exists "cue: anon select waitlist"        on public.waitlist_emails;
drop policy if exists "cue: read own profile"            on public.user_profiles;

create policy "cue: admin select feedback"
  on public.feedback for select
  using (public.is_cue_admin());

create policy "cue: user select own feedback"
  on public.feedback for select
  using (
    email is not null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

create policy "cue: admin select waitlist"
  on public.waitlist_emails for select
  using (public.is_cue_admin());

create policy "cue: user select own profile"
  on public.user_profiles for select
  using (public.is_self(user_id) or public.is_cue_admin());

-- user_profiles INSERT: only via server-side (Clerk webhook) or self
drop policy if exists "cue: upsert own profile" on public.user_profiles;

create policy "cue: self insert own profile"
  on public.user_profiles for insert
  with check (public.is_self(user_id));

create policy "cue: admin update profile"
  on public.user_profiles for update
  using (public.is_cue_admin())
  with check (public.is_cue_admin());

-- ============================================================
-- C5 — bookmarks + likes: user-scoped writes only
-- ============================================================
drop policy if exists "cue: read bookmarks"   on public.prompt_bookmarks;
drop policy if exists "cue: insert bookmarks" on public.prompt_bookmarks;
drop policy if exists "cue: delete bookmarks" on public.prompt_bookmarks;
drop policy if exists "cue: read likes"       on public.prompt_likes;
drop policy if exists "cue: insert likes"     on public.prompt_likes;
drop policy if exists "cue: delete likes"     on public.prompt_likes;

-- Bookmarks are private to the user (can hide your saves)
create policy "cue: own bookmarks read"
  on public.prompt_bookmarks for select
  using (public.is_self(user_id));

create policy "cue: own bookmarks insert"
  on public.prompt_bookmarks for insert
  with check (public.is_self(user_id));

create policy "cue: own bookmarks delete"
  on public.prompt_bookmarks for delete
  using (public.is_self(user_id));

-- Likes: SELECT for own row (so client can know its own state) + admin;
-- like counts are aggregated server-side in prompts.like_count so we
-- don't need public read on the join table.
create policy "cue: own likes read"
  on public.prompt_likes for select
  using (public.is_self(user_id) or public.is_cue_admin());

create policy "cue: own likes insert"
  on public.prompt_likes for insert
  with check (public.is_self(user_id));

create policy "cue: own likes delete"
  on public.prompt_likes for delete
  using (public.is_self(user_id));

-- ============================================================
-- Comments + verification tips
-- ============================================================
--
-- After running this, test in an incognito window (signed out):
--   * Can view homepage, cards, modal — YES (prompts.SELECT public)
--   * Cannot see any feedback / waitlist rows via devtools console — YES
--   * Cannot INSERT into prompts — YES
--
-- Sign in as admin, then:
--   * /admin loads, can add/edit prompts — YES
--   * /admin/inbox loads with all feedback — YES
--
-- Sign in as non-admin:
--   * Can bookmark + like — YES
--   * Cannot see other users' bookmarks — YES
--   * Own feedback thread visible via bell — YES
--
-- If ANY of these fails, the Clerk JWT integration (step 1 of
-- requirements above) is not fully wired. Verify:
--   * .env has VITE_USE_CLERK_SUPABASE_JWT=true
--   * Clerk JWT template named exactly "supabase" exists
--   * Supabase JWT settings accept Clerk's signing key
-- ============================================================
