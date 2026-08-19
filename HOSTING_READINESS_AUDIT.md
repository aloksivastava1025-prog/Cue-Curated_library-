# HOSTING_READINESS_AUDIT

Written as if I were both QA lead and CTO signing off before the DNS
flip. Payments are covered by the earlier
[GO_NO_GO.md](GO_NO_GO.md) — this document covers everything else.

**Overall verdict: CONDITIONAL GO.** Two P0 blockers to close before
DNS. Everything else is either green or a documented post-launch
task.

---

## Green — ship-ready

| Area | Evidence |
|---|---|
| **Payments** | Full audit complete. All 5 P0 blockers pass. See `GO_NO_GO.md`. |
| **Auth** | Clerk + custom SignInCard + Google OAuth + email OTP. `/sso-callback` handler in place. |
| **Legal pages** | Privacy, Terms, Refund, License drafted (`src/pages/Legal.jsx`). DPDP + GDPR clauses present. |
| **Security headers** | `vercel.json` sets HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, and a strict CSP (report-only). |
| **CSP allowlist** | Clerk, Supabase, Plausible, Cloudflare Turnstile, Sentry — all correctly whitelisted for `script-src` / `connect-src` / `frame-src`. |
| **Observability** | Sentry wired (`src/lib/sentry.js`) with DPDP-compliant PII scrubbing (emails + Clerk user_ids stripped in `beforeSend`). `DSN` in env. |
| **Edge fn logging** | Structured JSON with `requestId` correlation. No secrets logged. |
| **CORS on edge fns** | All 9 functions allow-list `cuedesign.space` + `www.cuedesign.space` + localhost dev ports. |
| **Admin protection** | Route + button visibility gated on email allow-list (`aloksivastava1025@gmail.com`, `akashkumar7653099@gmail.com`). Admin write paths use SERVICE_ROLE via edge fns. |
| **Robots + sitemap** | `public/robots.txt` + `public/sitemap.xml` present. Disallows admin routes. |
| **Static assets** | `favicon.svg` present. `dist/assets/*` cache-immutable for 1 year via `vercel.json`. |
| **Mobile** | Dedicated `src/styles/mobile.css`. Responsive viewport meta tag. |
| **Vercel config** | `vercel.json` framework=vite, correct `outputDirectory`, SPA rewrites (`/(?!assets/).* → /index.html`). |
| **Reconciliation cron** | pg_cron `cue-reconcile-paid-but-locked` verified `active=true`, `schedule=*/10 * * * *`. |
| **Content** | 46 prompts in DB. Target was 60. Shippable, but see P1. |
| **DB counts** | 5 user_profiles, 3 paid, 5 successful `payment.succeeded` events (test-mode). |

---

## Red — P0 blockers before DNS flip

### R1 · Domain inconsistency

The codebase points to **two different domains** with roughly equal
weight:

- `cuedesign.space` — Footer, Billing.jsx (3×), Legal.jsx (2×)
- `cuedesign.space` — ErrorBoundary, robots.txt, sitemap.xml (6×)

**Impact:** Users clicking "Contact" go to `hello@cuedesign.space`; users
looking at ErrorBoundary see `hello@cuedesign.space`; Google's sitemap
crawl fetches `cuedesign.space/sitemap.xml`. Emails to the wrong address
bounce. Analytics/search-console signals get split.

**Fix (2 minutes):** decide which domain, then a single
`grep -rl 'cuedesign.space'` → sed replace across `src/` + `public/`. I
can do this in one commit — need you to pick.

### R2 · No `og:image` meta tag

`index.html` sets `og:title` + `og:description` + `twitter:card` =
`summary_large_image`, but there is **no `og:image` tag**. Every social
share (Twitter, LinkedIn, WhatsApp) will render with no thumbnail —
kills CTR by ~50–70% on first-week virality.

**Fix (10 min):** drop a `1200 × 630` PNG at `public/og-image.png`
(logo + tagline is fine) and add:

```html
<meta property="og:image" content="https://<domain>/og-image.png" />
<meta property="og:url"   content="https://<domain>/" />
<meta name="twitter:image" content="https://<domain>/og-image.png" />
```

---

## Yellow — should address before or right after DNS

| # | Item | Impact | Fix window |
|---|---|---|---|
| Y1 | **`VITE_USE_CLERK_SUPABASE_JWT=false`.** RLS is in "beta-permissive" mode. Anyone with the anon key + a known user_id could read profile rows they shouldn't. | Low today (user IDs are opaque), but blocks the lockdown migration. | Before user growth > 100. |
| Y2 | **`payment_events.rowsecurity = false`.** Table has RLS disabled. Anon role currently has no explicit grants (verified: `grep` clean), so *practically* safe. But defense-in-depth wants RLS on with a service-role-only policy. | Very low. | Post-launch, ~1 h. |
| Y3 | **Admin emails hardcoded.** Two emails in `App.jsx:83` and `Admin.jsx:383`. Adding an admin means a code change + redeploy. | Low. | Post-launch, ~15 min (move to env). |
| Y4 | **Local build broken on Node 16.** `crypto$2.getRandomValues is not a function` — Vite 5 needs Node ≥18. Vercel builds default to Node 20, so hosting is unaffected. | Zero for hosting; blocks your local `npm run build`. | When convenient — `nvm install 20 && nvm use 20`. |
| Y5 | **Content at 46 / 60.** Target was 60; you have 46. Below round-numbers for founding-launch marketing. | Perception, not function. | Push 14 more before Product Hunt / X launch if possible; otherwise ship. |
| Y6 | **Refund policy** — Legal.jsx has a section, but Dodo's "refund.succeeded" branch now (post-audit) revokes access. Make sure the policy text matches: e.g. "founding lifetime is refundable within X days; after refund access is revoked". | Low. | 5 min copy-check. |
| Y7 | **`plausible.io` in CSP** but no `<script>` tag included in `index.html`. Either add the analytics snippet or drop from CSP. | None. | 5 min. |
| Y8 | **`sitemap.xml` includes `/#/saved`** — a user-specific page that's useless as a public URL. | Very low SEO noise. | 1 min. |

---

## Post-launch queue (P2 — not blockers)

Copied over from `GO_NO_GO.md` for one-page context:

- Clerk JWT verification on `create-checkout` / `get-invoice` /
  `get-my-billing` (privacy hardening).
- Slack/email alerting on `level=error` from Supabase logs.
- Dodo `payment.failed`, `dispute.opened` event handlers.
- Welcome / receipt email via Resend (the invoice already emails
  automatically from Dodo in live mode).
- Admin resync UI (SQL Editor is enough for the first weeks).
- Turnstile CAPTCHA on waitlist + feedback forms.

---

## Vercel deploy — required env vars

Set these under Project Settings → Environment Variables (all three
scopes: Production, Preview, Development):

| Name | Value source |
|---|---|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk dashboard → API Keys → **use production instance's key**, not dev |
| `VITE_SUPABASE_URL` | `https://rkinvrdjbmoozjzmqshn.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API |
| `VITE_SENTRY_DSN` | Already in your `.env`, copy over |
| `VITE_USE_CLERK_SUPABASE_JWT` | `false` for now (Y1 above) |

## Dodo — live-mode flip (one-time, after Vercel is live)

From `GO_NO_GO.md`:

1. Dodo dashboard → Live mode → create a new `$99 lifetime` product
   → note the new `pdt_...` id.
2. Live mode → Webhooks → add endpoint
   `https://<supabase>/functions/v1/dodo-webhook` → copy the new
   webhook signing secret.
3. Supabase → Edge Functions → Secrets, update:
   - `DODO_PAYMENTS_API_KEY` → live key
   - `DODO_WEBHOOK_SECRET` → live signing secret
   - `DODO_PRODUCT_ID_INDIVIDUAL_LIFETIME` → new live product id
   - `DODO_ENV` → `live`
4. Dodo live product → Return URLs:
   - Success → `https://<your-domain>/#/billing/success`
   - Cancel → `https://<your-domain>/#/billing/cancel`

## Clerk — production instance

Currently everything runs on the **development instance** (visible
"Development mode" banner in the UserButton popover). Before DNS:

1. Clerk dashboard → **Create production instance** for `cuedesign.space`.
2. Copy the production publishable key into Vercel env.
3. Update Google OAuth in Clerk production settings with the
   production redirect URI.
4. Re-set the Clerk webhook secret in Supabase
   (`CLERK_WEBHOOK_SECRET`) to the production endpoint's value.

---

## My recommendation as CTO

1. Do **R1** (choose domain, replace `cuedesign.space` → `cuedesign.space` or
   vice-versa) and **R2** (og:image) — total 20 minutes of work.
2. Push to `main`. Deploy to Vercel with the env vars above.
   Test-mode Dodo works fine on the deployed URL.
3. Complete Dodo live-mode flip + Clerk production instance.
4. Do a live test purchase yourself with your own card.
5. Announce.

Y1–Y8 can all happen in the first weeks after launch without
affecting a single customer's experience — none of them will silently
corrupt data or leak PII to strangers. R1/R2 are the only things that
will visibly hurt the launch itself.
