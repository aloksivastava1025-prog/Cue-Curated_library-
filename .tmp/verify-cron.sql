select
  (select exists (select 1 from pg_extension where extname='pg_cron'))              as pg_cron_installed,
  (select exists (select 1 from pg_indexes where indexname='payment_events_payment_id_uidx')) as payment_id_index,
  (select exists (select 1 from information_schema.views where table_name='founding_purchases')) as founding_view;
