select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('user_profiles','payment_events','rate_limit_windows')
order by table_name, ordinal_position;
