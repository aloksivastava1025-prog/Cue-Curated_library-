-- ============================================================
-- CUE v2.0 — Security Lockdown ROLLBACK
-- ============================================================
-- Reverses supabase-migration-security-lockdown.sql back to
-- beta-permissive RLS. Run ONLY if the lockdown breaks the app
-- and you need to restore access while debugging.
--
-- After running this, set VITE_USE_CLERK_SUPABASE_JWT=false
-- and restart the dev server / redeploy.
--
-- Safe to re-run.
-- ============================================================


-- ============================================================
-- 1. PROMPTS + PROMPT_CONTENTS → back to anon read/write
-- ============================================================
drop policy if exists "cue: public read prompts"       on public.prompts;
drop policy if exists "cue: admin write prompts"       on public.prompts;
drop policy if exists "cue: public read prompt_content" on public.prompt_contents;
drop policy if exists "cue: admin write prompt_content" on public.prompt_contents;

create policy "cue: anon read prompts"
  on public.prompts for select using (true);

create policy "cue: anon write prompts"
  on public.prompts for all
  using (true) with check (true);

create policy "cue: anon read prompt_content"
  on public.prompt_contents for select using (true);

create policy "cue: anon write prompt_content"
  on public.prompt_contents for all
  using (true) with check (true);


-- ============================================================
-- 2. STORAGE BUCKET → back to anon read/write
-- ============================================================
drop policy if exists "cue: public read cue-media"  on storage.objects;
drop policy if exists "cue: admin write cue-media"  on storage.objects;
drop policy if exists "cue: admin update cue-media" on storage.objects;
drop policy if exists "cue: admin delete cue-media" on storage.objects;

create policy "cue: read cue-media"
  on storage.objects for select
  using (bucket_id = 'cue-media');

create policy "cue: upload cue-media"
  on storage.objects for insert
  with check (bucket_id = 'cue-media');

create policy "cue: update cue-media"
  on storage.objects for update
  using (bucket_id = 'cue-media')
  with check (bucket_id = 'cue-media');

create policy "cue: delete cue-media"
  on storage.objects for delete
  using (bucket_id = 'cue-media');


-- ============================================================
-- 3. FEEDBACK_MESSAGES → back to anon
-- ============================================================
drop policy if exists "cue: user insert message"     on public.feedback_messages;
drop policy if exists "cue: admin insert message"    on public.feedback_messages;
drop policy if exists "cue: admin select messages"   on public.feedback_messages;
drop policy if exists "cue: user select own messages" on public.feedback_messages;

create policy "cue: anon insert message"
  on public.feedback_messages for insert with check (true);

create policy "cue: anon select messages"
  on public.feedback_messages for select using (true);


-- ============================================================
-- 4. FEEDBACK / WAITLIST / USER_PROFILES → back to anon
-- ============================================================
drop policy if exists "cue: admin select feedback"    on public.feedback;
drop policy if exists "cue: user select own feedback"  on public.feedback;
drop policy if exists "cue: admin select waitlist"     on public.waitlist_emails;
drop policy if exists "cue: user select own profile"   on public.user_profiles;
drop policy if exists "cue: self insert own profile"   on public.user_profiles;
drop policy if exists "cue: admin update profile"      on public.user_profiles;

create policy "cue: anon select feedback"
  on public.feedback for select using (true);

create policy "cue: anon select waitlist"
  on public.waitlist_emails for select using (true);

create policy "cue: read own profile"
  on public.user_profiles for select using (true);

create policy "cue: upsert own profile"
  on public.user_profiles for insert with check (true);


-- ============================================================
-- 5. BOOKMARKS + LIKES → back to anon
-- ============================================================
drop policy if exists "cue: own bookmarks read"   on public.prompt_bookmarks;
drop policy if exists "cue: own bookmarks insert" on public.prompt_bookmarks;
drop policy if exists "cue: own bookmarks delete" on public.prompt_bookmarks;
drop policy if exists "cue: own likes read"       on public.prompt_likes;
drop policy if exists "cue: own likes insert"     on public.prompt_likes;
drop policy if exists "cue: own likes delete"     on public.prompt_likes;

create policy "cue: read bookmarks"
  on public.prompt_bookmarks for select using (true);
create policy "cue: insert bookmarks"
  on public.prompt_bookmarks for insert with check (true);
create policy "cue: delete bookmarks"
  on public.prompt_bookmarks for delete using (true);

create policy "cue: read likes"
  on public.prompt_likes for select using (true);
create policy "cue: insert likes"
  on public.prompt_likes for insert with check (true);
create policy "cue: delete likes"
  on public.prompt_likes for delete using (true);


-- ============================================================
-- After running:
--   1. Set VITE_USE_CLERK_SUPABASE_JWT=false in .env + Vercel
--   2. Restart dev server or redeploy
--   3. Test: homepage loads, admin panel works, bookmarks work
--   4. Debug the JWT/RLS issue
--   5. Re-run supabase-migration-security-lockdown.sql when fixed
-- ============================================================
