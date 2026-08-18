# CUE v2.0 Hardening Blueprint — Review Feedback

> **Reviewer's take:** genuinely strong, professional-grade production plan.
> Score: **9/10 for a payment-taking beta.**
>
> This document is a critical review of the *Master Production Execution
> Blueprint v2.0* and its accompanying implementation summary. Written to
> be shared back with the partner who authored the blueprint.

---

## 🟢 Overall verdict

This reads like it was written by a real production engineer / SRE. Every
section has specific code + exact SQL — no vague "consider adding X."
The original v1 hardening (my earlier security work) laid a base;
**this v2 is a proper production layer on top of it.**

Two things stand out:

1. **Concurrency thinking** — every mutable-state operation has a
   DB-level fix, not application-level locking. That is the correct
   default for correctness.
2. **Rollback + rehearsal discipline** — staging Supabase project,
   pre-written rollback script, 48h canary watch. Real ops discipline,
   not launch-week bravado.

---

## ✨ What is genuinely excellent

### 1. Concurrency fixes (§3) — closes the real races
- **§3.1 Payment webhook idempotency via `webhook-id` PK** — industry
  standard (Stripe / Svix / Dodo all use this). The original wiring
  (`UPDATE plan = 'cue_plus'`) was only *accidentally* idempotent for
  that one field. Now the whole handler is properly guarded.
- **§3.2 Atomic rate limiter with `FOR UPDATE` lock** — the v1
  trigger-based rate limit had a SELECT-then-INSERT race under
  concurrent bot bursts. This closes it correctly.
- **§3.3 Server-side prompt IDs via `nextval()`** — replaces the
  retry-on-collision loop (which was a workaround, not a fix). Clean.
- **§3.4 Intent-based like / bookmark** — v1 sent "toggle from current
  state" which diverges under double-clicks. Explicit intent +
  `on conflict do nothing` is correct.
- **§3.6 Team seat locking** — this race wasn't even considered in v1.
  Good catch.

### 2. Payment security (§4.1) — realistic + implementable
- Preferred SDK path (`dodopayments` npm) plus manual HMAC fallback
  with **timing-safe compare + 5min replay window**. Standard Webhooks
  convention — same as Svix.
- Signature verify **before** payload processing. Correct order.

### 3. Rollback + rehearsal (§6, §7.1)
- `security_lockdown_rollback.sql` written **before** the forward
  migration runs in prod.
- Separate staging Supabase project.
- 48h canary watch before public.

### 4. Production-readiness gate (§9)
17 boxes, each actually verifiable. This is the single best artifact
in the document — literally a launch runway.

---

## 🟡 Small nits / clarifications needed

### 1. Prompt-ID sequence needs `setval()` on migration
The sequence starts at 1, but the existing DB already has `cue001`
through `cue038`. Without seeding `setval()`, `nextval()` returns 1 →
immediate collision on the very next admin save. Add to the migration:

```sql
select setval('prompt_id_seq', coalesce(
  (select max((substring(id from 4))::int) from prompts where id ~ '^cue\d+$'),
  0
));
```

### 2. CSP directives missing (§4.4)
Blueprint says "CSP scoped to Clerk, Plausible, Turnstile, Supabase"
but doesn't specify `script-src`, `connect-src`, `frame-src`, etc.
Clerk sign-in modal uses an iframe — if `frame-src` doesn't allow
`https://*.clerk.accounts.dev`, sign-in silently breaks. Suggest
shipping CSP in **Report-Only** mode first (`Content-Security-Policy-Report-Only`
header) and only enforcing after 48h of clean reports.

### 3. Dodo signature scheme verification
The blueprint is honest: *"confirm the exact header/signature format
against Dodo's current docs before relying on it in prod."* Correct
caveat, but this means **a staging test against real Dodo test events
is mandatory** before touching prod payments. Should be item #1 in the
concurrency test matrix (§7.2).

### 4. Payment model confusion — subscription vs lifetime?
The `create-checkout` implementation shown looks subscription-oriented
("plan-based checkout, existing plan check"). CUE's decided pricing is
**lifetime one-time** ($79 Individual / $249 Team). Need to confirm:
- Is the Dodo product type "One-time" or "Subscription"?
- Does the webhook set `plan_expires_at = null` (lifetime) or a
  renewal date?

If subscription code is being written for a lifetime product, the
mismatch will show up as recurring charge attempts or premature access
revocation.

### 5. Admin audit log — GC / retention strategy
`admin_audit_log` is append-only, which is right, but at 5 years of
operation it could grow to millions of rows. A retention policy
(archive after 24 months, or partition by month) should be a note in
the schema comment. Not urgent, but should be captured now.

### 6. Turnstile replay TTL — data model missing (§4.7)
Blueprint says "store used token hashes with a short TTL" but doesn't
specify how. Options:
```sql
create table turnstile_tokens_seen (
  token_hash text primary key,
  seen_at    timestamptz not null default now()
);
-- + a scheduled function that DELETEs rows > 10 min old
```
Or use Deno KV / Upstash Redis for automatic TTL. Blueprint should
pick one.

---

## 🟠 Gaps / thoda incomplete

### 1. `feedback_messages` (reply threads) missing from RLS reference (§4.3)
The RLS example covers `prompts` and `prompt_bookmarks` only.
`feedback_messages` has a critical impersonation risk (anon inserting
with `author='admin'` — flagged as **C3 Critical** in v1 audit).
Should be an explicit example in the reference, not left to inference.

### 2. Clerk `user.deleted` cascade not detailed
Mentioned in the test matrix (§7.2) but no implementation code. This
is a **DPDP right-to-erasure** requirement — should have the same
weight as the payment webhook. Suggest:
```sql
-- Called by Clerk user.deleted webhook
create or replace function delete_user_cascade(p_user_id text)
returns void language plpgsql security definer as $$
begin
  delete from prompt_bookmarks   where user_id = p_user_id;
  delete from prompt_likes       where user_id = p_user_id;
  delete from feedback_messages  where author_email = (
    select email from user_profiles where user_id = p_user_id
  );
  update feedback set email = null where email = (
    select email from user_profiles where user_id = p_user_id
  );
  delete from user_profiles      where user_id = p_user_id;
end;
$$;
```

### 3. `autofill-metadata` rate limit example missing
Cost-bearing endpoint (Claude API charges per call). Blueprint says
"add a per-minute cap via the rate-limit function in §3.2, keyed on
admin user id" but no example. Suggest:
```ts
const ok = await supabase.rpc('check_and_increment_rate_limit', {
  p_key: `autofill:${adminUserId}`,
  p_max: 30,
  p_window_seconds: 60,
})
if (!ok) return new Response('Rate limit', { status: 429 })
```

### 4. Missing: git history secret-leak audit
Basic hygiene, but worth explicit callout. Run **gitleaks** or
**trufflehog** on the full git history before public launch — cheap
insurance that no key was ever accidentally committed and then
"removed" (git history keeps the blob).

---

## 🔵 Scale realism — is all of this needed *now*?

Every hardening item is genuine engineering practice. But CUE's
realistic scale at launch is **100–500 users**. Prioritising:

### Must-do for launch (real risk, would bite you)
- All §3 concurrency fixes ✅
- §4.1 signature verification ✅
- §4.2 secrets separation ✅
- §4.4 CORS allow-list ✅
- §4.6 admin audit log ✅
- §7.2 concurrency test matrix ✅

### Should-do (perceived quality / compliance)
- Turnstile replay protection (bots will find it if not blocked)
- Clerk user-delete cascade (DPDP compliance)
- Structured logs on edge functions

### Nice-to-have (over-engineered for beta scale)
- Connection pooling via port 6543 — matters at 100+ concurrent
  Postgres connections. Probably not for months post-launch.
- k6 / autocannon load test — nice, skip-able for beta.
- PITR restore drill — should be tested eventually, not launch blocker.
- CSP directives — real risk, but easy to break Clerk. Ship in
  **Report-Only mode first**, enforce after clean 48h.

### Post-launch iteration
- Cursor-based pagination (trigger: >150 items)
- Admin audit log partitioning
- Regional Redis if traffic ever explodes

---

## 🎯 Bottom line — three things to confirm before starting

1. **Payment model:** Lifetime one-time or subscription? Blueprint code
   language leans subscription. Pick one, align every payment-related
   file to it.

2. **Prompt ID sequence `setval()` fix:** Add it to the migration
   before running, else immediate collision on cue039 insert.

3. **Staging Supabase project:** Blueprint mandates staging-first,
   which is right. Options:
   - Create a **new** staging project (~30 min setup)
   - OR treat current project as staging and spin up a clean prod
     project — more work but cleaner separation

Once these three are locked, the **Days 1–12 execution order (§8) can
run as-is.** That sequence genuinely gets CUE to launch-ready.

---

## Overall assessment

If the partner authored this level of production-grade plan, CUE's
technical foundation will be solid. Everything in here that isn't a
nit is either:

- A **real defect** the plan correctly closes, or
- A **discipline** (staging rehearsal, rollback scripts, canary watch)
  that pays for itself the first time something goes wrong.

**Ship this. Rely on them.**

---

*Prepared by the code-side reviewer after reading the blueprint end-to-end
and cross-referencing against the current CUE codebase state.*
