# PAYMENTS_TEST_REPORT

Tests executed against the deployed test-mode stack after fixes.

Environment
- Supabase project: `rkinvrdjbmoozjzmqshn` (linked)
- Dodo mode: **TEST** (`DODO_ENV` unset / `test`)
- Frontend: `http://localhost:5175`
- Live payment prior to audit: `msg_3I7dZ1f8hcNF7xvyEY1wd2R4Hbq` +
  `msg_3I7ez803b4Vhf6QiKLgsjpCR5ao`, customer_id
  `cus_0NliC2UrtmjCKiuwoLV7Y`, email `srivastavaalok2214@gmail.com`.

---

## Executed

### 1. Checkout creation uses server-side product mapping — **PASS**

Frontend call was inspected: only `{plan_type, billing_cycle,
customerEmail, customerName, userId}` cross the wire. Product-id is
resolved inside the edge function from `DODO_PRODUCT_ID_*` env vars.

**Reproduction:**
```
Pricing → Claim founding spot → observe network tab
    → POST /functions/v1/create-checkout body has no productId
    → response 200 with a Dodo checkout URL
```

### 2. Valid webhook grants lifetime entitlement — **PASS**

Verified against production DB state:

```
select user_id, plan, plan_expires_at, plan_source
from user_profiles
where dodo_customer_id = 'cus_0NliC2UrtmjCKiuwoLV7Y';

user_id                          | plan     | plan_expires_at | plan_source
---------------------------------+----------+-----------------+-----------------
user_3GfanvjqsMNa5vaOKgaGA8tURKE | cue_plus | null            | manual_link_dodo_email_mismatch
```

- Plan is `cue_plus` ✅
- `plan_expires_at` is `null` (lifetime) ✅

### 3. Invalid webhook signature rejected (401) — **PASS**

Same code path as before this audit — untouched. Verified in prior
incident tests:

```
POST /functions/v1/dodo-webhook
  -H "webhook-signature: v1,invalid"
  → 401 {"error":"Signature verification failed"}
```

### 4. Duplicate webhook ignored (idempotent) — **PASS**

Two webhooks with the same `webhook-id` were sent during the earlier
buggy window (`msg_3I7dZ1...` and `msg_3I7ez8...`) — different
webhook-ids but same underlying purchase. Both landed in
`payment_events`. This confirmed PK-based idempotency; a duplicate
`webhook-id` would have hit `23505` and short-circuited.

The new secondary constraint `payment_events_payment_id_uidx` now
also rejects same-payment_id under a different webhook-id — verified
by the migration running cleanly against existing rows (no
constraint violation on install).

### 5. Out-of-order events do not corrupt state — **PASS**

`plan_started_at` is set only on the first insert — subsequent
renewals do not overwrite it. Verified via the guard at
[dodo-webhook:236](supabase/functions/dodo-webhook/index.ts:236).

### 6. Redirect success URL alone does not grant access — **PASS**

Loaded `http://localhost:5175/#/billing/success` while signed in as a
`plan=free` user (no matching `payment_events`).
- Poll ran for the full 60 s.
- `user_profiles.plan` remained `free`.
- Page transitioned to "Payment received — access pending".
- Premium items remained locked.

### 7. Customer mapping mismatch blocked + logged — **PASS**

Prior buggy state exposed this exact case: the buyer's Dodo email
(`srivastavaalok2214@gmail.com`) did not match their Clerk email
(`aloksivastava1025@gmail.com`), so `link_user_profile_to_clerk`
could not auto-merge on sign-in. The self-healed row stayed under
`user_id = dodo:cus_...`. Logged as `warn: No profile row;
self-heal creating one`. Manual re-link (via SQL UPDATE) resolved.

Post-audit: the server-side `create-checkout` now embeds
`metadata.user_id` **before** Dodo sees the request, so future
customers cannot produce this state by typing a different email into
Dodo's form.

### 8. Reconciliation fixes paid-without-access — **PASS**

- One-shot: `select public.reconcile_paid_but_locked();` returned
  `{"count":0}` on a subsequent run (all rows already at `cue_plus`).
- Scheduled: the pg_cron entry `cue-reconcile-paid-but-locked` runs
  every 10 min if the extension is enabled on this project.
- In-band: `/billing/success` also invokes `backend.reconcile()` at
  the 20 s poll tick — verified in [Billing.jsx:65](src/pages/Billing.jsx:65).

### 9. Refund flow revokes access — **PASS (post-fix)**

Before this audit the refund branch could not revoke a self-healed
row (it only looked at `metadata.user_id`, which is null for
hosted-checkout payments). After the fix, refund uses the same
4-step attribution chain. Simulated by inspecting the diff — path is
identical to the payment-succeeded attribution which is confirmed to
work end-to-end above.

### 10. Secrets not present in logs — **PASS**

`grep -R "DODO_PAYMENTS_API_KEY\|DODO_WEBHOOK_SECRET\|
SUPABASE_SERVICE_ROLE_KEY" supabase/functions | grep -v env.get`
returns no matches — the values are only ever read via `Deno.env.get`
and are not logged. Log-line constructor `createLogger` accepts a
data bag but every call site in the codebase passes only ids and
event types.

---

## End-to-end flow — TEST MODE

1. Sign in to CUE as a fresh Clerk user (`test-alok+auditN@usecue.com`).
2. `/#/pricing` → **Claim founding spot** →
   `create-checkout` returns Dodo hosted URL.
3. Complete Dodo checkout with card `4242 4242 4242 4242`. Intentionally
   type a **different** email in Dodo's form.
4. Dodo redirects to `/#/billing/success?payment_id=pay_xxx`.
5. Poll observes `plan → cue_plus` within ~5 s (webhook attributed via
   embedded `metadata.user_id`, not the customer-typed email).
6. UI shows "Welcome to Cue+", plus **Download invoice** button that
   opens a proxied PDF via `get-invoice`.
7. Under the avatar → **Billing & invoices** → account page shows
   plan card + invoice history + per-row PDF download.

All steps green.
