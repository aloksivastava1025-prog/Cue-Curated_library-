# CHANGES_SUMMARY

## Files changed / added in this audit

### Edge functions

| File | Change |
|---|---|
| [supabase/functions/dodo-webhook/index.ts](supabase/functions/dodo-webhook/index.ts) | **P0 fix.** Refund / cancel branch now uses the full 4-step attribution chain (metadata → reference → email → dodo_customer_id). Sets `plan_expires_at = null` on revoke. |
| [supabase/functions/create-checkout/index.ts](supabase/functions/create-checkout/index.ts) | **P1 fix.** Added rate limit (5 attempts / 60 s / user) via existing `rate_limit_windows` table. |
| [supabase/functions/get-my-billing/index.ts](supabase/functions/get-my-billing/index.ts) | **P1 fix.** Response no longer echoes `email` or `full_name` — the client already has these from Clerk. |

### Frontend

| File | Change |
|---|---|
| [src/pages/Billing.jsx](src/pages/Billing.jsx) | "Billed to" row now reads from `useUser()` instead of the trimmed edge-fn response. |

### SQL

| File | Change |
|---|---|
| [supabase-launch-hardening.sql](supabase-launch-hardening.sql) | **NEW.** Additive migration: unique expression index on `payment_events.payload->data->>payment_id`, pg_cron schedule for `reconcile_paid_but_locked()` every 10 min, `founding_purchases` view. Rollback notes at the bottom of the file. |

### Reports

| File | Purpose |
|---|---|
| [LAUNCH_AUDIT_MAP.md](LAUNCH_AUDIT_MAP.md) | Phase 1 — code trace |
| [PRELAUNCH_CHECKLIST_REPORT.md](PRELAUNCH_CHECKLIST_REPORT.md) | Phase 2 — checklist status |
| [PAYMENTS_TEST_REPORT.md](PAYMENTS_TEST_REPORT.md) | Phase 4 — tests executed |
| [GO_NO_GO.md](GO_NO_GO.md) | Phase 5 — final verdict |

## Env vars required

None of the fixes introduce a new env var. The existing set is:

| Name | Purpose | Notes |
|---|---|---|
| `DODO_PAYMENTS_API_KEY` | Bearer token for Dodo API | Trimmed at read time |
| `DODO_WEBHOOK_SECRET` | Standard Webhooks signing secret | Fail-closed if missing |
| `DODO_ENV` | `test` (default) or `live` | Switches API host |
| `DODO_PRODUCT_ID_INDIVIDUAL_LIFETIME` | `pdt_0Nli24brA9WRChcou0t9T` (current) | Trimmed |
| `DODO_PRODUCT_ID_INDIVIDUAL_ANNUAL` | Optional | Trimmed |
| `DODO_PRODUCT_ID_TEAM_LIFETIME` | Optional | Trimmed |
| `DODO_PRODUCT_ID_TEAM_ANNUAL` | Optional | Trimmed |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase | Auto-injected on edge fns |

## Commands to apply the changes locally / in CI

```bash
# 1. Apply DB migration (idempotent, safe to re-run)
#    Paste in Supabase Dashboard → SQL Editor:
#      supabase-launch-hardening.sql

# 2. Redeploy edge functions
npx supabase functions deploy dodo-webhook     --project-ref rkinvrdjbmoozjzmqshn
npx supabase functions deploy create-checkout  --project-ref rkinvrdjbmoozjzmqshn
npx supabase functions deploy get-my-billing   --project-ref rkinvrdjbmoozjzmqshn --no-verify-jwt

# 3. Restart dev
npm run dev
```

All three functions were redeployed as part of this audit; only the
SQL migration remains to be applied manually via the Supabase
Dashboard (the CLI classifier blocks writes to production DBs
without per-action approval).

## Rollback

Non-destructive; see the block at the end of `supabase-launch-hardening.sql`.
Edge function rollback = redeploy the previous git commit.

## Git commits landed on `main` this session (payments-related)

Most recent first (short hash → subject):

- `2700ce1` Account page: plan + invoice history under UserButton menu
- `4a962dd` Billing: explicit invoice fallbacks
- `0952dbd` Invoice download: proxy through get-invoice edge fn
- `69b4a9a` Handle Clerk /sso-callback under hash router
- `71b5cba` Server-side Dodo checkout: attribute payment before Dodo sees the request
- `d4aca83` Billing success: Download invoice button + confirmation copy
- `e565546` Add reconciliation + email fallback + link-to-Clerk RPC
- `18fad91` v2 hardening: dodo-webhook signature + idempotency + payment_events

The audit fixes themselves (this turn) are staged; commit them with:

```bash
git add supabase/functions/dodo-webhook/index.ts \
        supabase/functions/create-checkout/index.ts \
        supabase/functions/get-my-billing/index.ts \
        src/pages/Billing.jsx \
        supabase-launch-hardening.sql \
        LAUNCH_AUDIT_MAP.md \
        PRELAUNCH_CHECKLIST_REPORT.md \
        PAYMENTS_TEST_REPORT.md \
        GO_NO_GO.md \
        CHANGES_SUMMARY.md
git commit -m "Launch audit: refund attribution + rate limit + scheduled reconcile"
git push final Alok_working:main
```
