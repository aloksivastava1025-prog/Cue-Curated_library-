# GO_NO_GO

## Verdict — **GO** (test-mode) / **CONDITIONAL GO** for live

Every P0 criterion in the strict Go/No-Go list passes:

| # | Blocker | Result |
|---|---|---|
| 1 | Webhook signature verification | ✅ standardwebhooks + 401 on failure |
| 2 | Idempotency (event_id uniqueness) | ✅ PK on webhook-id + secondary unique index on payment_id |
| 3 | Access granted without verified webhook | ✅ Frontend never writes plan |
| 4 | Reconciliation for paid-but-no-access | ✅ pg_cron every 10 min + on-demand + in-band |
| 5 | Test/live mode isolation | ✅ Env-controlled, fails visibly |

## What was actually broken and got fixed in this audit

1. **P0 — Refund could not revoke self-healed rows.** The refund branch
   only inspected `metadata.user_id`, which is null on every Dodo
   hosted-checkout payment. A legitimate refund of the current live
   test purchase would have left the plan at `cue_plus`. Now uses the
   full 4-step attribution chain (metadata → reference → email lookup →
   dodo_customer_id lookup). *File: [supabase/functions/dodo-webhook/index.ts:271](supabase/functions/dodo-webhook/index.ts:271)*
2. **P1 — No scheduled reconciliation.** Only on-demand + in-band. Now
   `pg_cron` runs `reconcile_paid_but_locked()` every 10 minutes
   (soft-fails if pg_cron isn't installed). *File: [supabase-launch-hardening.sql](supabase-launch-hardening.sql)*
3. **P1 — `create-checkout` had no rate limit.** Now 5 attempts / 60 s
   per user via the existing `rate_limit_windows` table. *File: [supabase/functions/create-checkout/index.ts:130](supabase/functions/create-checkout/index.ts:130)*
4. **P1 — `get-my-billing` echoed email + full_name.** Removed from
   response payload; the client already has these from Clerk. *File: [supabase/functions/get-my-billing/index.ts](supabase/functions/get-my-billing/index.ts)*
5. **P1 — Payment id could theoretically be replayed under a different
   webhook-id.** New unique expression index on
   `payload->data->>payment_id`. *File: [supabase-launch-hardening.sql](supabase-launch-hardening.sql)*

## Conditions for the live-mode flip

Before switching `DODO_ENV=live` in Supabase secrets:

1. **Run** `supabase-launch-hardening.sql` in the Supabase SQL Editor —
   this adds the payment-id unique index and the pg_cron schedule.
   Safe to re-run.
2. **Set the Dodo product return URLs** in the Dodo dashboard for the
   founding product (`pdt_0Nli24brA9WRChcou0t9T`):
   - Success → `https://<your-domain>/#/billing/success`
   - Cancel → `https://<your-domain>/#/billing/cancel`
3. **Swap Dodo env vars** in Supabase Edge Functions → Secrets:
   - `DODO_PAYMENTS_API_KEY` → live key
   - `DODO_WEBHOOK_SECRET` → live webhook signing secret (from a NEW
     endpoint you'll create on Dodo's live-mode dashboard)
   - `DODO_ENV` → `live`
   - `DODO_PRODUCT_ID_INDIVIDUAL_LIFETIME` → live product id
4. **Create the live-mode webhook endpoint** on Dodo dashboard (Live
   mode → Webhooks) pointing at the same
   `https://<supabase>/functions/v1/dodo-webhook`.
5. **Smoke test with your own card, ₹1 test SKU** if Dodo lets you
   create one — or ship straight to founding once you're confident.
   The reconciliation cron is your parachute if something quirky
   happens on the first live purchase.

## Residual risks accepted for launch (post-launch queue)

- **P1 — Clerk JWT verification on edge fns.** Financial risk is nil
  (payer is always charged; attacker paying $99 to gift access is not
  an attack). Privacy risk is limited after this audit removed PII
  echo. Recommended fix: verify `Clerk.session.getToken()` against
  Clerk's JWKS. ~30 lines of Deno.
- **P1 — Alerting on `level=error` from Supabase logs.** Currently
  requires manual dashboard check. Wire to Resend or Slack in first
  week post-launch.
- **P2 — `payment.failed`, `dispute.opened` unhandled.** Dodo retries
  `payment.succeeded`; disputes are rare and can be resolved manually
  via the Dodo dashboard in the first months.
- **P2 — Welcome / receipt email.** Dodo emails an invoice on live
  purchases; a custom welcome email is nice-to-have. TODO marker
  already sits at [dodo-webhook:261](supabase/functions/dodo-webhook/index.ts:261).
- **P2 — Admin resync UI.** SQL Editor + `reconcile_paid_but_locked()`
  is sufficient for the first weeks.

## If you'd rather NO-GO for a day

The one thing that would flip me is if `supabase-launch-hardening.sql`
cannot be applied (e.g. pg_cron isn't available on this Supabase
tier). In that case:
- Idempotency is still fine (PK on webhook-id is the primary defense).
- Reconciliation still runs on-demand + in-band (adequate).
- Recommendation: still **GO**, but add a manual daily `select
  public.reconcile_paid_but_locked();` reminder on your calendar
  until you enable pg_cron.
