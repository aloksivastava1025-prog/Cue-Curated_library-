# LAUNCH_AUDIT_MAP

Phase-1 output — every payment-critical artifact traced to its code
path, with a risk grade. Findings that were fixed in this audit
appear again in `PRELAUNCH_CHECKLIST_REPORT.md` and
`CHANGES_SUMMARY.md`.

---

## 1. Checkout / session creation

| Path | Function | Notes | Risk |
|---|---|---|---|
| [supabase/functions/create-checkout/index.ts:45](supabase/functions/create-checkout/index.ts:45) | `serve` handler | Validates `plan_type` ∈ {`cue_plus`,`cue_plus_team`}, `billing_cycle` ∈ {`annual`,`lifetime`}, email regex. Product-id resolved server-side from `DODO_PRODUCT_ID_*` env vars (frontend cannot influence). Rejects if user already has a non-free plan. Rate-limited via `rate_limit_windows` (5/min/user). | P2 |
| [src/pages/Pricing.jsx:63](src/pages/Pricing.jsx:63) | `startFoundingCheckout` | Async click handler — invokes edge fn, redirects on success. No product/price sent from client. | ✅ |
| [src/lib/backend.js:650](src/lib/backend.js:650) | `backend.createFoundingCheckout` | Only wraps the invoke — passes Clerk userId + email + name. | ✅ |

## 2. Webhook endpoint + signature verification

| Path | Function | Notes | Risk |
|---|---|---|---|
| [supabase/functions/dodo-webhook/index.ts:31](supabase/functions/dodo-webhook/index.ts:31) | `serve` handler | Uses `standardwebhooks@1.0.0` (Dodo convention). Rejects on missing headers (400), stale timestamp >5 min (400), invalid signature (401). Raw `req.text()` is used for verification. | ✅ |
| [supabase/functions/dodo-webhook/index.ts:116](supabase/functions/dodo-webhook/index.ts:116) | idempotency insert | Inserts into `payment_events` with `id = webhook-id` (PK). Postgres `23505` = duplicate → short-circuit 200 with `{duplicate: true}`. No side effects run on a dup. | ✅ |

## 3. Entitlement / access grant

| Path | Function | Notes | Risk |
|---|---|---|---|
| [supabase/functions/dodo-webhook/index.ts:145](supabase/functions/dodo-webhook/index.ts:145) | `payment.succeeded` branch | 4-step attribution chain: `metadata.user_id` → `reference` → email lookup → dodo_customer_id lookup → **self-heal insert** (`dodo:<cust>` or `email:<email>`). Upsert to `user_profiles.plan`; preserves original `plan_started_at` on renewals. `plan_expires_at = null` for lifetime. | ✅ |
| [supabase-hotfix-payment-attribution.sql:23](supabase-hotfix-payment-attribution.sql:23) | `link_user_profile_to_clerk` RPC | Called from `ensureUserProfile` on sign-in. Rebinds a self-healed row's `user_id` to the real Clerk id when the emails match. | ✅ |
| [supabase/functions/dodo-webhook/index.ts:271](supabase/functions/dodo-webhook/index.ts:271) | refund/cancel branch | **Fixed in this audit**: now uses the same 4-step attribution chain, so refunds revoke self-healed rows too. Sets `plan='free'`, `plan_expires_at=null`, `plan_source='dodo_refund'`. | ✅ (P0 was open — fixed) |
| [src/pages/Billing.jsx:22](src/pages/Billing.jsx:22) | `BillingSuccess` | Polls `user_profiles.plan` every 2s for 60s. **Never writes plan** — display only. Calls `reconcile()` at the 20s mark as safety net. | ✅ |
| [src/components/Modal.jsx](src/components/Modal.jsx) | paywall gate | Reads `plan` via `backend.getMyProfile(user.id, user)` — server-controlled entitlement, no client-side unlock. | ✅ |

## 4. Reconciliation

| Path | Function | Notes | Risk |
|---|---|---|---|
| [supabase-hotfix-payment-attribution.sql:90](supabase-hotfix-payment-attribution.sql:90) | `reconcile_paid_but_locked()` RPC | Walks last 7 days of `payment_events` where `event_type ∈ (payment.succeeded, subscription.active, subscription.renewed)`. Grants entitlement to any paid identifier (email or customer_id) not currently at `cue_plus`. Idempotent. | ✅ |
| [supabase-launch-hardening.sql](supabase-launch-hardening.sql) | `pg_cron` schedule `cue-reconcile-paid-but-locked` | **New in this audit** — runs `reconcile_paid_but_locked()` every 10 min. Falls back to no-op if `pg_cron` extension is not installed on the project. | ✅ (P1 was open — fixed) |
| [src/pages/Billing.jsx:60](src/pages/Billing.jsx:60) | in-band recovery | Success page calls `backend.reconcile()` at the 20s poll tick as a last-ditch safety net before showing "access pending". | ✅ |

## 5. Refunds, disputes, failures

| Event | Handler | Behavior |
|---|---|---|
| `refund.succeeded` | dodo-webhook:271 | revoke (`plan='free'`) |
| `subscription.canceled` / `.cancelled` | dodo-webhook:271 | revoke |
| `subscription.failed` | dodo-webhook:271 | revoke |
| `subscription.on_hold` | dodo-webhook:271 | revoke |
| `payment.failed` | not handled | See P1 in checklist report |
| `dispute.opened` | not handled | See P1 in checklist report |

## 6. DB schema

| Table | PK | Extras |
|---|---|---|
| `user_profiles` | `user_id text` | `email`, `plan`, `plan_source`, `plan_started_at`, `plan_expires_at`, `dodo_customer_id`, `team_owner_id`, `team_seats`. Indexes: `lower(email)` (from hotfix), `dodo_customer_id`. |
| `payment_events` | `id text` (= webhook-id) | `event_type`, `payload jsonb`, `user_id`, `processed_at`. **NEW** unique expr-index on `payload->data->>payment_id` where event_type='payment.succeeded' — belt-and-suspenders idempotency. |
| `rate_limit_windows` | `key text` | `count int`, `reset_at`. Reused by `create-checkout` (this audit). |

## 7. Observability

| Area | Where | Notes |
|---|---|---|
| Structured JSON logs | dodo-webhook + create-checkout | Every log line is JSON with `service`, `requestId`, `level`, `msg`, plus event/user context (never secrets). |
| Correlation | `requestId` per request (crypto.randomUUID). `webhookId`, `paymentId`, `productId`, `userId` are stamped on key transitions. | ✅ |
| Alerts | ❌ Not wired to Slack/Resend | See P1 in checklist. Supabase Dashboard log filters cover this manually pre-launch. |

## 8. Test vs live isolation

| Boundary | Mechanism |
|---|---|
| Dodo API host | `DODO_ENV === 'live'` → `live.dodopayments.com`, else `test.dodopayments.com` (both create-checkout and get-invoice). |
| Env var: API key | `DODO_PAYMENTS_API_KEY` — trimmed at read-time to survive dashboard paste whitespace. |
| Env var: webhook secret | `DODO_WEBHOOK_SECRET`. If missing → 500 (fail-closed). |
| Env var: product ids | `DODO_PRODUCT_ID_INDIVIDUAL_LIFETIME` / `_ANNUAL` / `_TEAM_LIFETIME` / `_TEAM_ANNUAL` — trimmed. |
| Guardrail | Test-mode API key + `DODO_ENV=live` would produce a Dodo 401 at checkout — user gets a clean error surface via `dodo_status` passthrough. Not silent breakage. |

## Findings summary

| # | Severity | Area | Status |
|---|---|---|---|
| A1 | **P0** | Refund branch attribution ignored self-heal chain | **Fixed** in dodo-webhook:271 |
| A2 | P1 | No scheduled reconciliation cron | **Fixed** in supabase-launch-hardening.sql |
| A3 | P1 | `create-checkout` had no rate limit | **Fixed** using existing `rate_limit_windows` |
| A4 | P1 | `get-my-billing` echoed `email` + `full_name` | **Fixed** — dropped from response payload |
| A5 | P1 | Edge fns don't verify Clerk JWT (accept `userId` from body) | **Deferred** — post-launch; documented in GO_NO_GO |
| A6 | P2 | `payment.failed` and `dispute.opened` not handled | **Deferred** — post-launch |
| A7 | P2 | No welcome/receipt email (Resend TODO in code) | **Deferred** — Dodo emails invoice; app shows Download button |
| A8 | P2 | No admin resync UI | **Deferred** — SQL Editor + reconcile RPC covers ops |
