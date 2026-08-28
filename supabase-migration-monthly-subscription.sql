-- ============================================================
-- CUE — Monthly subscription support
-- ============================================================
-- Adds the columns the webhook + cancel flow need to run a real
-- monthly subscription against Dodo. All changes are additive —
-- no data migration is needed for existing lifetime users, whose
-- rows will simply keep NULL in these new columns.
-- ============================================================

-- Dodo's subscription id (sub_...) — set on subscription.active
-- and used by cancel-subscription to PATCH the right subscription.
-- Existing lifetime users have NULL here, which is exactly what
-- the cancel endpoint keys off ("nothing to cancel").
alter table user_profiles
  add column if not exists dodo_subscription_id text;

-- The next scheduled auto-renew, as reported by Dodo. Shown on
-- the Billing page as "Next billing date". Nullable for lifetime.
alter table user_profiles
  add column if not exists next_billing_date timestamptz;

-- Auto-renew status. Defaults to true for active monthlies; flips
-- to false when the user hits "Cancel" (period-end cancel policy)
-- or when Dodo reports subscription.paused / on_hold. Ignored for
-- lifetime plans.
alter table user_profiles
  add column if not exists auto_renew boolean not null default true;

-- Counter of consecutive failed renewals — used to escalate from
-- soft nudge (1 failure) to hard past_due (3+). Reset on the next
-- successful renewal.
alter table user_profiles
  add column if not exists failed_renewal_count int not null default 0;

-- ============================================================
-- Renewal notifications — a tiny table that records what we've
-- already emailed the user about, so a repeated webhook (Dodo
-- retries succeeded events on delivery failure) does not spam
-- the user with duplicate renewal receipts.
-- ============================================================
create table if not exists renewal_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  event_type text not null,          -- 'renewal_success' | 'renewal_failed' | 'cancel_scheduled' | 'cancel_final'
  dodo_event_id text,                -- for dedupe against webhook retries
  subscription_id text,
  sent_at timestamptz not null default now()
);

create index if not exists renewal_notifications_user
  on renewal_notifications (user_id, sent_at desc);

create unique index if not exists renewal_notifications_dedupe
  on renewal_notifications (dodo_event_id)
  where dodo_event_id is not null;
