select 'prompts' as name, count(*) from public.prompts
union all select 'user_profiles', count(*) from public.user_profiles
union all select 'paid_users',    count(*) from public.user_profiles where plan in ('cue_plus','cue_plus_team')
union all select 'successful_payments', count(*) from public.payment_events where event_type='payment.succeeded'
union all select 'feedback_messages',   count(*) from public.feedback_messages
union all select 'waitlist_emails',     count(*) from public.waitlist_emails;
