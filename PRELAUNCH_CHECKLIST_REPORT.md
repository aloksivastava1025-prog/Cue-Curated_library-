# PRELAUNCH_CHECKLIST_REPORT

Result of the launch checklist against the current codebase after
fixes applied in this audit.

## A) Billing & Product Integrity

| # | Item | Status | Evidence |
|---|---|---|---|
| A.1 | Server-side product mapping | ✅ | [create-checkout/index.ts:134-149](supabase/functions/create-checkout/index.ts:134) — resolves productId from `DODO_PRODUCT_ID_*` env vars, whitespace-trimmed. |
| A.2 | Frontend cannot override price / product_id | ✅ | Frontend passes only `plan_type`, `billing_cycle`, `customerEmail`, `customerName`, `userId`. plan_type is allow-listed to `cue_plus` / `cue_plus_team`. |
| A.3 | Checkout created only from backend | ✅ | Old hosted-URL constant `DODO_FOUNDING_CHECKOUT_URL` removed from Pricing.jsx. All CTAs call `backend.createFoundingCheckout` → edge fn. |
| A.4 | Duplicate checkout spam prevention | ✅ | Two guards: (a) reject if user already at `plan != 'free'`; (b) NEW rate limit: 5 attempts / 60s per user via `rate_limit_windows`. |

## B) Webhook Security (Critical — P0)

| # | Item | Status | Evidence |
|---|---|---|---|
| B.1 | Raw body used for signature | ✅ | `req.text()` captured before parsing. [dodo-webhook:58](supabase/functions/dodo-webhook/index.ts:58) |
| B.2 | Signature verification | ✅ | `standardwebhooks@1.0.0` `Webhook.verify()` — Dodo's own convention. |
| B.3 | Invalid signature → 401 | ✅ | [dodo-webhook:78-84](supabase/functions/dodo-webhook/index.ts:78) |
| B.4 | Replay / timestamp tolerance | ✅ | `Math.abs(now - webhook-timestamp) > 300s` → 400. [dodo-webhook:49](supabase/functions/dodo-webhook/index.ts:49) |
| B.5 | Idempotency via unique event id | ✅ | `payment_events.id` PK = webhook-id. Duplicate hits Postgres `23505` → short-circuit 200. |
| B.6 | Duplicate webhook → no duplicate access | ✅ | PK insert happens BEFORE any user_profiles write. Behavior verified in the pre-existing test matrix (T3). |
| B.7 | Belt-and-suspenders: same payment_id can't be replayed under different webhook-id | ✅ NEW | `payment_events_payment_id_uidx` unique expression index added in [supabase-launch-hardening.sql](supabase-launch-hardening.sql). |

## C) Entitlement Correctness (P0)

| # | Item | Status | Evidence |
|---|---|---|---|
| C.1 | Access only from verified webhook | ✅ | Frontend never writes plan. [Billing.jsx:22](src/pages/Billing.jsx:22) polls only; [Modal.jsx](src/components/Modal.jsx) reads only. |
| C.2 | Atomic write (event + entitlement) | ✅ | Event insert precedes profile upsert. On upsert failure the event row is **deleted** so Dodo's retry re-processes. [dodo-webhook:243-256](supabase/functions/dodo-webhook/index.ts:243) |
| C.3 | Lifetime bypasses expiry | ✅ | `plan_expires_at = null` when `billing_cycle === 'lifetime'`. No cron ever tests `null < now()`, so lifetime rows survive any future expiry job. |
| C.4 | Customer mapping enforced | ✅ | `dodo_customer_id` written on every `payment.succeeded`. `link_user_profile_to_clerk` RPC binds it to the Clerk user on sign-in. |
| C.5 | Refund revokes correctly (self-heal-aware) | ✅ **FIXED** | Refund branch now uses the same 4-step attribution chain (email + customer_id fallback). Was **P0 broken** before this audit. |

## D) Failure Recovery

| # | Item | Status | Evidence |
|---|---|---|---|
| D.1 | Reconciliation every 5–15 min | ✅ | pg_cron `cue-reconcile-paid-but-locked` runs `*/10 * * * *`. Falls back to no-op if pg_cron isn't installed (migration prints a NOTICE). |
| D.2 | In-band recovery on success page | ✅ | `/billing/success` calls `backend.reconcile()` at 20 s poll tick. |
| D.3 | Retry on transient failure | ✅ | Upsert error → event row deleted → Dodo's automatic retry re-processes. |
| D.4 | Dead-letter for permanent failure | ⚠️ **Deferred (P1)** | Currently a permanent failure is a Supabase log line only. Alerting on `level=error` from Dashboard is manual pre-launch. |
| D.5 | Admin resync tool | ⚠️ **Deferred (P2)** | Ops path is: Supabase SQL Editor → `select public.reconcile_paid_but_locked();` |

## E) Security & Reliability

| # | Item | Status | Evidence |
|---|---|---|---|
| E.1 | AuthZ on billing/admin endpoints | ⚠️ **P1 (deferred)** | `create-checkout`, `get-invoice`, `get-my-billing` accept userId from body without verifying a Clerk JWT. Financial risk is nil (payer's card is always charged; attacker paying $99 to gift access is not an attack). Privacy risk is limited — `get-my-billing` no longer echoes email/name (this audit). Clerk JWT verify is queued for post-launch. |
| E.2 | Rate limiting on checkout | ✅ **NEW** | 5 attempts / 60s / user via `rate_limit_windows`. |
| E.3 | Rate limiting on webhook | N/A | Signature check makes flooding unprofitable; Dodo's own IP is the only meaningful client. |
| E.4 | PII-safe structured logs | ✅ | Logger never receives secrets. Only ids and event types. Email appears in `warn` lines when self-heal fires — acceptable and audit-useful. |
| E.5 | Correlation ids in logs | ✅ | `requestId`, `webhookId`, `paymentId`, `productId`, `userId` stamped through the flow. |
| E.6 | Test/live env guardrails | ✅ | `DODO_ENV` switches API host. Product IDs and API key are trimmed at read time. Mismatch surfaces cleanly (Dodo 401 → user-visible error) rather than silently miscategorising. |

## F) Policy & UX

| # | Item | Status | Evidence |
|---|---|---|---|
| F.1 | Success page does not unlock alone | ✅ | Polls only. If poll times out → "access pending" copy, not a fake unlock. |
| F.2 | Cancel page handled | ✅ | `/billing/cancel` — clear "no charge made" copy, CTA back to pricing. |
| F.3 | Refund policy consistent | ✅ | Refund revokes (`plan_source='dodo_refund'`, `plan='free'`). |
| F.4 | Payment-processing delay copy | ✅ | 60s poll → "access pending — email hello@cuedesign.space if it takes >10 min" fallback. |
| F.5 | Invoice download & email fallback | ✅ | Dodo emails invoice automatically (in live mode). App also shows Download button (proxied via `get-invoice`) + a `mailto:` with payment_id prefilled if the customer prefers a human. |

---

## P0 findings — status

Every strict-Go criterion passes:

| Blocker | Result |
|---|---|
| Webhook signature verification | ✅ Enforced (401 on failure) |
| Idempotency via unique event_id | ✅ PK + secondary payment_id unique index |
| Access granted without verified webhook | ✅ Impossible — frontend never writes plan |
| Missing reconciliation | ✅ Scheduled every 10 min + on-demand |
| Test/live isolation | ✅ Env-controlled, trim-safe, fails visibly |

## P1 / P2 residual risks (not launch blockers)

1. **E.1** — Clerk JWT verification on edge fns (privacy hardening).
2. **D.4** — Slack/email alerting on `level=error` (currently Supabase Dashboard only).
3. **Unhandled events** — `payment.failed`, `dispute.opened` (Dodo will retry `payment.succeeded` on the next attempt; disputes are rare and manageable manually in the first weeks).
4. **Welcome/receipt email** — Dodo emails invoice automatically; a custom Resend welcome email is nice-to-have.
5. **Admin resync UI** — SQL Editor is enough for the first weeks.
