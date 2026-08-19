-- Content count
select
  (select count(*) from public.prompts)                              as total_prompts,
  (select count(*) from public.prompts where published_at is not null) as published_prompts,
  (select count(*) from public.user_profiles)                        as total_users,
  (select count(*) from public.user_profiles where plan in ('cue_plus','cue_plus_team')) as paid_users;

-- RLS status on payment/user tables
select tablename,
       rowsecurity as rls_enabled,
       (select count(*) from pg_policies where schemaname=t.schemaname and tablename=t.tablename) as num_policies
from pg_tables t
where schemaname='public'
  and tablename in ('user_profiles','payment_events','prompts','purchases','waitlist_emails','monthly_waitlist','user_feedback','admin_audit_log')
order by tablename;
