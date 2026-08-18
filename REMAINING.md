# CUE — Remaining Work (v2.0 Production Blueprint)

> Updated from the Master Production Execution Blueprint v2.0.
> Everything not yet done, ranked by whether it blocks launch.
> Companion doc to [PROJECT.md](PROJECT.md).

Legend:
- 🔴 **P0** — blocks public launch. Cannot ship without.
- 🟠 **P1** — strongly recommended before launch. Impacts quality/safety.
- 🟡 **P2** — post-launch. Iterate after first users.
- 👤 **your action** — needs Alok's account setup or decision
- 💻 **code ready** — code artifact already created, needs deployment
- ✅ **done** — code written and merged

---

## ✅ v2 Hardening — Code Complete

### Database Migrations
- [x] 💻 `supabase-v2-hardening.sql` — payment_events, rate_limit_windows, prompt_id_seq, prompt_views, admin_audit_log, team seat constraint, indexes
- [x] 💻 `supabase-v2-lockdown-rollback.sql` — safety net to revert strict RLS

### Backend Hardening
- [x] ✅ `backend.js` — server-side prompt IDs, intent-based like/bookmark, audit logging, view counter via edge function
- [x] ✅ `AppContext.jsx` — in-flight request tracking, stale-response protection

### Edge Function Hardening
- [x] ✅ `dodo-webhook` — idempotency, signature verification, replay protection, structured logging, plan upgrade
- [x] ✅ `create-checkout` — input validation, CORS allow-list, plan-based checkout
- [x] ✅ `record-view` — NEW edge function for deduped view tracking
- [x] ✅ `send-contact` — CORS allow-list

### Security Config
- [x] ✅ `vercel.json` — CSP, HSTS, X-Frame-Options, CORS headers, asset caching
- [x] ✅ `.env.example` — all v2 secrets documented

---

## 🔴 P0 — Launch Blockers (Deployment Actions)

### Infrastructure (👤 required)

- [ ] 👤 **Buy domain** — options: `usecue.com`, `getcue.co`, `cue.build`, `trycue.com`. ~$15/yr
- [ ] 👤 **Vercel deployment**
  - Import GitHub repo → `main` branch
  - Env vars: `VITE_CLERK_PUBLISHABLE_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SENTRY_DSN`, `VITE_USE_CLERK_SUPABASE_JWT=true`
  - Attach custom domain
- [ ] 👤 **Clerk production instance**
  - Create in Clerk dashboard
  - Add production URLs to allow-list
  - Generate `pk_live_...` key → replace in Vercel env
- [ ] 💻 **Swap hardcoded strings** after domain confirmed
  - `hello@usecue.com` → real support email
  - `usecue.com` in sitemap.xml + robots.txt + Legal.jsx `CONTACT_EMAIL`
  - Social profile URLs in Footer.jsx
  - CORS origins in all edge functions (currently `https://usecue.com`)

### Security (👤 + 💻)

- [ ] 👤 **Clerk JWT template setup** (5 min)
  - Clerk Dashboard → JWT Templates → New → "Supabase" preset
  - Name: exactly `supabase`
  - Claims: `sub = user.id`, `email = user.primaryEmailAddress`
  - Copy signing key → Supabase Dashboard → Settings → JWT
- [ ] 👤 **Create staging Supabase project** (separate from prod)
  - Run `supabase-full-setup.sql` + `supabase-v2-hardening.sql`
  - Run `supabase-migration-security-lockdown.sql`
  - Test: homepage, admin, bookmarks, likes all work
- [ ] 👤 **Run lockdown migration in prod** ONLY after staging passes
  - Flip `VITE_USE_CLERK_SUPABASE_JWT=true` in Vercel env
  - Keep rollback script (`supabase-v2-lockdown-rollback.sql`) ready
- [ ] 💻 **Run `supabase-v2-hardening.sql`** in staging then prod

### Payment Integration (👤 + 💻)

- [ ] 👤 **Dodo Payments setup**
  - Create Dodo account
  - Create two products: "CUE+ Individual" ($79) and "CUE+ Team" ($249)
  - Get API key + webhook secret
  - Set secrets in Supabase Edge Functions:
    ```
    npx supabase secrets set DODO_PAYMENTS_API_KEY=sk_...
    npx supabase secrets set DODO_WEBHOOK_SECRET=whsec_...
    npx supabase secrets set DODO_PRODUCT_ID_INDIVIDUAL=prod_...
    npx supabase secrets set DODO_PRODUCT_ID_TEAM=prod_...
    npx supabase secrets set DODO_ENV=test
    ```
  - Register webhook URL: `https://<supabase-url>/functions/v1/dodo-webhook`
- [ ] 💻 **Deploy edge functions**
  ```
  npx supabase functions deploy dodo-webhook
  npx supabase functions deploy create-checkout
  npx supabase functions deploy record-view
  npx supabase functions deploy send-contact
  ```
- [ ] 💻 **Run concurrency tests** (§7.2)
  - Duplicate webhook delivery → should short-circuit with 200
  - Invalid/expired signature → should return 401
  - Reused webhook-id → should return { duplicate: true }

### Content

- [ ] 💻 **Content push** — target 55–60 items (currently ~38)
- [ ] 💻 **AI autofill rate limit** — gate to admin JWT + 5/min cap

---

## 🟠 P1 — Pre-launch Quality

### Communications
- [ ] 👤 **Resend setup** — domain verification, welcome/receipt templates
- [ ] 💻 **Wire Resend into dodo-webhook** — send email after plan upgrade (idempotent via payment_events)
- [ ] 💻 **Resend for admin reply notifications** — email user when admin replies to feedback

### Anti-Abuse
- [ ] 💻 **Cloudflare Turnstile** — integrate on waitlist + feedback forms
  - Set `TURNSTILE_SECRET` in edge function secrets
  - Add token replay protection (store used token hashes with short TTL)
- [ ] 💻 **Rate limit on `autofill-metadata`** — keyed on admin user_id, 5/min

### Testing (§7.2)
- [ ] 💻 **RLS test matrix** — anon/self/other/admin × every table
- [ ] 💻 **Like/bookmark concurrency test** — two simultaneous requests, same user
- [ ] 💻 **Feedback burst test** — confirm rate limiter holds under concurrency
- [ ] 💻 **Turnstile tests** — invalid, expired, reused token
- [ ] 💻 **Load test** — k6/autocannon on checkout, view-increment, feedback-submit

### Observability (§6)
- [ ] 💻 **Sentry alerting** — set up alerts on edge-function error rate
- [ ] 💻 **Uptime monitoring** — UptimeRobot/Better Uptime on a health endpoint
- [ ] 👤 **Confirm Supabase PITR** — point-in-time recovery enabled
- [ ] 💻 **Test restore once** — restore from backup in staging

---

## 🟡 P2 — Post-launch

- [ ] Analytics (Plausible or PostHog)
- [ ] Cursor-based pagination (once library > 150 items)
- [ ] Search improvements (full-text, filters)
- [ ] Clerk `user.deleted` webhook → cascade delete bookmarks/likes/feedback
- [ ] Key rotation schedule (Dodo/Resend/Anthropic — quarterly)
- [ ] Awwwards polish pass

---

## 📋 Production-Readiness Gate (§9)

Do not flip `VITE_USE_CLERK_SUPABASE_JWT=true` in **prod** until:

- [ ] Lockdown migration + rollback script both tested in staging
- [ ] Dodo webhook: idempotency table, signature verification, duplicate-delivery test
- [ ] Feedback/waitlist rate limiter passes concurrent-burst test
- [ ] Prompt IDs generated server-side (sequence), no client-picked-ID path
- [ ] Like/bookmark endpoints are intent-based and idempotent
- [ ] View counter is edge-function-only, deduped by DB constraint
- [ ] Team seat allocation is lock-protected
- [ ] CORS allow-list set (no `*`), CSP + HSTS headers live
- [ ] All secrets confirmed absent from `VITE_*` and Sentry payloads
- [ ] Admin audit log capturing all admin mutations
- [ ] Turnstile token reuse blocked
- [ ] Indexes applied on all high-traffic FK columns
- [ ] autofill-metadata rate-limited per admin user
- [ ] Structured logs + at least one alert channel for edge-function failures
- [ ] Backup/PITR confirmed enabled, one restore tested
- [ ] Full RLS test matrix passes
- [ ] Soft-launch canary run for 48h with no unexplained errors
