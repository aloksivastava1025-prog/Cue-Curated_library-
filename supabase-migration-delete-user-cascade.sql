-- ============================================================
-- CUE — delete_user_cascade RPC
-- Called by the clerk-webhook edge function on user.deleted events.
-- Handles DPDP Act 2023 right-to-erasure across every table that
-- holds user data.
-- ============================================================

create or replace function public.delete_user_cascade(p_user_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_deleted json;
begin
  -- Grab the email before removing the profile row (used for tables
  -- that key on email rather than clerk user_id).
  select email into v_email
  from public.user_profiles
  where user_id = p_user_id;

  -- 1. Owned-by-user_id tables — hard delete
  delete from public.prompt_bookmarks where user_id = p_user_id;
  delete from public.prompt_likes     where user_id = p_user_id;

  -- 2. Owned-by-email tables — hard delete (if we know the email)
  if v_email is not null then
    delete from public.feedback_messages   where author_email = v_email;
    delete from public.waitlist_emails     where email = v_email;
    delete from public.monthly_waitlist    where email = v_email;
  end if;

  -- 3. Feedback: keep the message for admin analytics but anonymize
  --    the email. This is the standard "soft anonymize" pattern under
  --    DPDP — content stays, PII removed.
  if v_email is not null then
    update public.feedback
       set email = null
     where email = v_email;
  end if;

  -- 4. Finally, remove the profile itself
  delete from public.user_profiles where user_id = p_user_id;

  -- Return a small audit record the edge function can log
  v_deleted := json_build_object(
    'user_id', p_user_id,
    'email',   v_email,
    'deleted_at', now()
  );
  return v_deleted;
end;
$$;

-- Only callable server-side (edge function using service_role key).
-- We revoke public execute so anon / authenticated cannot invoke it.
revoke execute on function public.delete_user_cascade(text) from public;
revoke execute on function public.delete_user_cascade(text) from anon;
revoke execute on function public.delete_user_cascade(text) from authenticated;
grant  execute on function public.delete_user_cascade(text) to service_role;

-- ============================================================
-- After running this, deploy the clerk-webhook edge function and
-- register it in Clerk Dashboard. See instructions in
-- supabase/functions/clerk-webhook/README.md
-- ============================================================
