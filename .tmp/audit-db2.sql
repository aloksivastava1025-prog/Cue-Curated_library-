select
  (select count(*) from public.prompts) as total_prompts,
  (select count(*) from public.user_profiles) as total_users,
  (select count(*) from public.user_profiles where plan in ('cue_plus','cue_plus_team')) as paid_users,
  (select count(*) from public.payment_events where event_type='payment.succeeded') as successful_payments;

select tablename, rowsecurity as rls
from pg_tables t
where schemaname='public'
  and tablename in ('user_profiles','payment_events','prompts','waitlist_emails','monthly_waitlist','feedback_messages','purchases','user_inbox','admin_audit_log','saved_items','prompt_views')
order by tablename;
