# Cue — Project Handbook

> Living reference for anyone (human or AI) picking up work on cuedesign.space.
> Written by Alok + Claude, September 2026.
> When something changes, update this file and commit — this is the single source of truth.

---

## Table of Contents

1. [What Cue is](#1-what-cue-is)
2. [Stack overview](#2-stack-overview)
3. [Repositories & deployment topology](#3-repositories--deployment-topology)
4. [Environment variables](#4-environment-variables)
5. [Local development](#5-local-development)
6. [Database schema (Supabase)](#6-database-schema-supabase)
7. [Row-Level Security (RLS)](#7-row-level-security-rls)
8. [Edge functions](#8-edge-functions)
9. [Cloudflare R2 (media storage)](#9-cloudflare-r2-media-storage)
10. [Auth (Clerk)](#10-auth-clerk)
11. [Payments (Dodo)](#11-payments-dodo)
12. [Feature flags](#12-feature-flags)
13. [Scripts](#13-scripts)
14. [Admin runbook — common SQL queries](#14-admin-runbook--common-sql-queries)
15. [Emergency procedures](#15-emergency-procedures)
16. [Analytics](#16-analytics)
17. [SEO](#17-seo)
18. [Automation (GitHub Actions)](#18-automation-github-actions)
19. [Support & external accounts](#19-support--external-accounts)
20. [Future roadmap](#20-future-roadmap)
21. [Component authoring standard — HTML-first](#21-component-authoring-standard--html-first)

---

## 1. What Cue is

- **Product**: a curated library of Awwwards-tier UI components with AI prompts + React source, plus (eventually) an MCP server so components are callable inside Cursor / Claude Desktop / Windsurf.
- **URL**: https://cuedesign.space
- **Pricing**: $99 lifetime (founding 50) → $249 after; monthly $49; custom pack fair-priced.
- **Founder**: Alok Srivastava — solo, India.
- **Positioning**: taste over volume. 119 hand-picked components vs Aceternity's 262. Direct peers: Aceternity, Magic UI, React Bits, Cult UI. Distinctive: WebGL / 3D depth (43 components) plus lifetime pricing.

---

## 2. Stack overview

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 + Vite | Fast HMR, simple deploy |
| Router | Custom hash-based (window.location.hash) | Fast, no router lib. Future: BrowserRouter for SEO |
| Auth | Clerk | Managed, cheap, Google OAuth built-in |
| Database | Supabase (Postgres) | Postgres + RLS + edge functions in one |
| Edge functions | Supabase Deno runtime | Colocated with DB, no cold-start pain |
| Media storage | Cloudflare R2 | **Unlimited free egress** — was on Supabase Storage, migrated after 213 GB bandwidth incident |
| Payments | Dodo Payments (Merchant of Record) | India-friendly, auto tax/GST, USD+INR |
| Analytics | PostHog + Google Analytics 4 | PostHog for product funnels, GA4 for traffic |
| Email | ImprovMX (forwarding) → Gmail | Free, `hello@cuedesign.space` → personal inbox |
| Hosting | Vercel | Auto-deploy on push, edge network |
| CDN | Vercel + Cloudflare R2 built-in | R2 auto-serves via `pub-*.r2.dev` |
| Error monitoring | Sentry | Client-side with email/user_id scrubbed |

---

## 3. Repositories & deployment topology

Two GitHub repos are involved:

| Remote | Repo | Purpose |
|---|---|---|
| `origin` | `aloksivastava1025-prog/Cue-Curated_library-` | Personal / historical fork |
| `final` | `aloksivastava1025-prog/Cue_Final_build` | **Production repo. Vercel deploys from here.** |

**Deploy rule** — always push to `final/main`. Since `main` and `final/main` have diverged (same work under different SHAs), use cherry-pick pattern:

```bash
git checkout -b tmp-deploy final/main
git cherry-pick <commit>
git push final tmp-deploy:main
git checkout main
git branch -D tmp-deploy
```

The user has a preferred `.claude/settings.local.json` that pre-authorises `Bash(git push:*)` etc so AI agents can push without prompting each time.

Vercel:
- Project: `cue-final-build`
- Production branch: `main` (of `Cue_Final_build`)
- Framework preset: Vite
- Build command: `npm run build` (runs `check-video && gen-sitemap && vite build`)
- Output: `dist/`

---

## 4. Environment variables

### Frontend (Vite public — safe to expose)
Prefixed `VITE_`, injected into bundle:

- `VITE_SUPABASE_URL` — `https://rkinvrdjbmoozjzmqshn.supabase.co`
- `VITE_SUPABASE_ANON_KEY` — public anon key
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk public key
- `VITE_POSTHOG_KEY` — PostHog public key
- `VITE_POSTHOG_HOST` — `https://us.i.posthog.com`
- `VITE_DODO_PAYMENT_LINK_FOUNDING` — direct-link fallback (server-side create-checkout is primary)

### Edge function secrets (Supabase → Functions → Secrets)
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT` — `https://5a72e35f30dd9a1cb3813a790227f08d.r2.cloudflarestorage.com`
- `R2_BUCKET` — `cue-media`
- `R2_PUBLIC_URL` — `https://pub-bffac370ca114a6f873486297600ac6f.r2.dev`
- `CLERK_JWKS_URL` — Clerk's JWKS endpoint
- `DODO_API_KEY` — Dodo secret key
- `DODO_WEBHOOK_SECRET` — Dodo webhook signing key

### Local `.env.local` (git-ignored)
Adds R2 + Supabase service role for scripts:
- `R2_*` (same values as edge secrets)
- `SUPABASE_SERVICE_ROLE_KEY` — server-side bypass RLS

### GitHub Actions (`Cue_Final_build` → Settings → Secrets)
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_ENDPOINT`
- `R2_BUCKET`

Needed by `.github/workflows/optimize-videos.yml`.

---

## 5. Local development

```bash
# Install
npm install

# Dev server (port 5173)
npm run dev

# Full build (runs check-video + gen-sitemap + vite build)
npm run build

# Regenerate sitemap only
npm run gen-sitemap
```

**Video conventions check** — `scripts/check-video-conventions.js` runs at build time and blocks any file that uses `preload="auto"` or `.load()` outside the allowlist. If you add a new component that mounts `<video>`, either:
- Match the "mount only on user intent" pattern (EditorialCard, FeaturedRail, CategoryRail) and add the file to `allowedFiles`
- Or drop `preload="auto"`

Reason: a Supabase Storage bandwidth incident in Aug 2026 (213 GB egress in days) was caused by preloading videos on cold mount. Migration to R2 fixed cost, this script prevents regression.

---

## 6. Database schema (Supabase)

Project ref: `rkinvrdjbmoozjzmqshn`. All schema lives in `public`. Key tables:

### `prompts`
The library. One row per component.
Columns (main):
- `id` (text, PK) — `cue001`, `cue002`, ...
- `title` (text)
- `description` (text)
- `category` (text) — e.g. "3D & WebGL", "Sections & Layouts"
- `tags` (text[])
- `tier` (text) — `free` or `premium`
- `thumb_src` (text) — R2 URL
- `hover_src` (text) — R2 URL (was Cloudinary before migration)
- `code` (text) — React source (mostly empty today; only `cue056` has code)
- `source_credit` (text)
- `rail` (text) — `featured` for Design of the Day
- `view_count` (int)
- `like_count` (int)
- `created_at` (timestamptz)

Prompts have no `status` column — every row is treated as published.

### `prompt_contents`
The actual prompt text, separated so the browse call is cheap.
- `prompt_id` (text, FK)
- `prompt` (text) — the AI prompt

### `user_profiles`
One row per Clerk user, created lazily on first sign-in.
- `user_id` (text, PK) — Clerk user ID
- `email` (text)
- `plan` (text) — `free`, `cue_plus`, `cue_plus_team`
- `plan_source` (text) — `dodo_webhook`, `manual_link_dodo_email_mismatch`, `reconciliation`, `edge_fallback`
- `plan_started_at`
- `plan_expires_at` (null for lifetime)
- `dodo_customer_id`
- `team_seats` (int)

### `feedback`
Contact form + feedback modal submissions.
- `id`, `email`, `message`, `page_path`, `created_at`

### `poll_responses`
Multi-row per session for the FoundingPoll survey.
- `poll_id` — e.g. `founding-signal-v3:blocker`, `founding-signal-v3:contact`
- `choice`, `free_text`
- `session_id` (client-generated)
- `seconds_on_site`, `page_path`, `created_at`

### `rate_limit_windows`
Per-IP rate-limit buckets for anon endpoints.

### `admin_audit_log`
Every admin mutation, actor email, before/after JSON, timestamp.

### `mcp_api_keys` *(not deployed yet — scaffold committed under `mcp/`)*
For the future MCP server.
- `user_id`, `key_prefix`, `key_hash`, `created_at`, `revoked_at`

---

## 7. Row-Level Security (RLS)

Every table has RLS enabled. Key policies live in `supabase-migration-*.sql` files at repo root. Recent security lockdown (Aug 2026):

- `prompts` — anon read-only on non-premium rows; premium read gated by an edge function that checks the caller's Clerk JWT + plan.
- `user_profiles` — user can read only their own row; admin (whitelisted emails) can read all via edge function.
- `feedback` — anon insert allowed (contact form); read-only for admin via edge function.
- `poll_responses` — anon insert allowed (rate-limited); read-only for admin.
- `admin_audit_log` — admin-only read; write via SECURITY DEFINER function `log_admin_action`.
- `rate_limit_windows` — service-role only.

If you migrate the schema, always re-check RLS. Never `alter table ... disable row level security` in prod.

---

## 8. Edge functions

Directory: `supabase/functions/`. All deployed with `--no-verify-jwt` because the Supabase gateway can't verify Clerk-issued JWTs (they're RS256, not the Supabase HS256). Verification happens inside each function via `_shared/clerk.ts`.

Deploy:
```bash
npx supabase functions deploy <name> --no-verify-jwt --project-ref rkinvrdjbmoozjzmqshn
```

Key functions:

| Function | Purpose |
|---|---|
| `create-checkout` | Server-side Dodo checkout session with metadata.user_id bound to Clerk user |
| `dodo-webhook` | Payment / subscription events → update user_profiles.plan |
| `get-user-plan` | Auth'd plan lookup with email fallback (fixes RLS-block on client) |
| `get-prompt-content` | Premium prompt fetch — verifies Clerk JWT + plan before returning text |
| `upload-to-r2` | Legacy admin upload — buffers file, signs SigV4 PUT (kept for compatibility) |
| `r2-presign` | **New primary uploader** — issues a presigned PUT URL, browser uploads directly to R2. No egress through Supabase. |
| `autofill-metadata` | AI-driven metadata suggestions for admin |
| `record-view` | Increments `prompts.view_count` |
| `record-like` | Toggles like state |
| `admin-message-user` | Admin dashboard "send message" flow (currently manual only, no auto-send per org policy) |

Shared helpers in `_shared/`:
- `clerk.ts` — `verifyClerkJwt`, `verifyClerkAdmin` with 10 min JWKS cache and email fallback via user_profiles lookup
- `rateLimit.ts` — `enforceIpRateLimit` using rate_limit_windows table

---

## 9. Cloudflare R2 (media storage)

- **Bucket**: `cue-media` (public via `pub-bffac370ca114a6f873486297600ac6f.r2.dev`)
- **Current usage**: ~500 MB storage, 100% of hover-videos migrated from Cloudinary.
- **Alerts**: two Usage-Based Billing alerts set:
  - R2 storage > 8 GB (80% of free tier)
  - R2 Class B ops > 8M/month (80% of free tier)
  - Both email `hello@cuedesign.space`

### Upload flow (post r2-presign migration)

1. Browser calls `r2-presign` with Clerk token
2. Function verifies JWT, generates a 5-min signed PUT URL
3. Browser PUTs the file directly to R2 — Supabase never touches the bytes
4. Frontend saves the new R2 URL to the prompt row

### Optimisation pipeline

Every uploaded video is remuxed with:
- `-vf scale='min(1280,iw)':-2` — cap width at 720p
- `-c:v libx264 -b:v 1500k -preset veryfast`
- `-movflags +faststart` — moov atom at file start (biggest playback win)
- `-c:a copy`

Runs automatically every 30 min via GitHub Actions (see [§18](#18-automation-github-actions)). Files are tagged with `x-cue-optimized: 1` metadata so the script is idempotent.

Manual run:
```bash
node scripts/optimize-r2-videos.js --run
```

Cloudinary → R2 one-shot migration (kept for reference — everything migrated):
```bash
node scripts/migrate-cloudinary-to-r2.js --run
```

---

## 10. Auth (Clerk)

- Provider: Google OAuth + email/password
- JWT delivery: session token via `window.Clerk.session.getToken()` — attached as `Authorization: Bearer <token>` on all authed calls
- Admin emails (hardcoded whitelist across the codebase — search `ADMIN_EMAILS`):
  - `akashkumar7653099@gmail.com`
  - `aloksivastava1025@gmail.com`
  - `aloks.int@teachforindia.org`

To add a new admin: add the email to the whitelist in **all** of these files:
- `src/pages/Admin.jsx`
- `src/pages/AdminPolls.jsx`
- `src/pages/AdminInbox.jsx`
- `src/pages/AdminSubscriptions.jsx`
- `src/pages/AdminCustomPacks.jsx`
- `src/components/EditorialCard.jsx`
- `supabase/functions/_shared/clerk.ts`

---

## 11. Payments (Dodo)

Merchant of Record — handles tax/GST for buyers automatically. Cue never touches card data.

### Products (Dodo dashboard IDs — verify before wiring)
- **Cue+ Founding Lifetime** — $99 (INR ₹8,299 equivalent, after removing PPP discount)
- **Cue+ Monthly** — $49/month
- **CUE49 discount code** — 20% off on founding lifetime, matches Dodo dashboard config

### Checkout flow
1. Frontend calls edge function `create-checkout` with `{user, couponCode, billingCycle}`
2. Function creates Dodo session with `metadata.user_id = <clerk_id>` so webhook can attribute
3. Frontend redirects to `checkout.dodopayments.com/...`
4. On success → Dodo fires `payment.succeeded` webhook → `dodo-webhook` function → updates `user_profiles.plan = 'cue_plus'` with `plan_source = 'dodo_webhook'`

### Payout math (approx, USD founding sale)
- Buyer pays: $99.00
- Dodo fee: ~$5.95 (~5.5% + $0.50)
- FX/wire margin: ~1.5%
- Alok's bank: **~$91.65**

For India buyers with 18% GST included at Dodo, net after GST + fees is ~₹4,670 per standard sale.

### Refunds
Full policy at `cuedesign.space/#/legal/refund`. To refund manually: Dodo dashboard → payment → **Refund**. Then update `user_profiles.plan = 'free'` for that user (SQL below).

---

## 12. Feature flags

Simple JS constants — Vite inlines them at build time. Flip and redeploy.

### `src/lib/features.js`

```js
export const COUPON_ENABLED = true    // CUE49 promo toggle. Turns on:
                                      //   - Hero pill live timer
                                      //   - Pricing PromoToggle ($99 vs $79)
                                      //   - WelcomeCard "New month special" line
                                      //   - Everyone-can-see coupon reveal
                                      // Flip to false to hide the promo everywhere.
```

Future flags land here — one constant per campaign / experiment.

### `PREVIEW_LIMIT` (in `CategoryRail.jsx`)

Number of cards a signed-out visitor sees before the sign-in gate.
Currently `4`. Increase or decrease as needed.

---

## 13. Scripts

All under `scripts/`. Each has usage comments in the header — read the top of the file first.

| Script | Purpose |
|---|---|
| `generate-sitemap.js` | Rebuild `public/sitemap.xml` with every prompt + static route. Runs on every build. |
| `check-video-conventions.js` | Blocks `preload="auto"` outside allowlist. Runs pre-build. |
| `optimize-r2-videos.js` | Re-encode + faststart every mp4 in R2. Idempotent via `cue-optimized` metadata tag. |
| `migrate-cloudinary-to-r2.js` | One-shot: pull Cloudinary hover_src, run through optimizer, upload to R2, update DB. |
| `restore-cue001.js` | Recover cue001 hover_src if it goes missing. |
| `import-partner-data.js` | Bulk import from partner data source. |

---

## 14. Admin runbook — common SQL queries

Run these in Supabase → **SQL Editor**. `service_role` bypasses RLS; regular `postgres` role obeys it.

### Founder-owned test accounts — standard exclusion list

Every admin count / report / marketing-email query should exclude these so metrics reflect real users only. Add a new email to this list every time you make another personal test account.

```sql
-- Standard test-account exclusion. Paste into every user-facing
-- report so real-user counts and email sends don't include the
-- founder's own signups.
lower(email) not in (
  -- Admin / founder accounts (whitelisted in code too)
  'aloks.int@teachforindia.org',
  'akashkumar7653099@gmail.com',
  'aloksivastava1025@gmail.com',
  'srivastavaalok2214@gmail.com',
  -- Personal test accounts
  'aloksrivastava1144@gmail.com',
  'aloksrivastava_ec24a11_028@dtu.ac.in',
  '10programmer11@gmail.com',
  'shubhanshsrivastava18@gmail.com',
  'akashkumar7653011@gmail.com'
)
```

**Where this fragment goes:** every query in this section that reports on real users (free-user counts, marketing email extracts, founding counts, subscription lists). The `getFoundingCount()` in `backend.js` uses a subset of this list (only the 3 admin accounts); the wider test-account net lives in SQL so ad-hoc reports can dedupe cleanly.

### Grant Cue+ lifetime to a user (paid conversion, one-off)

```sql
update user_profiles
set 
  plan = 'cue_plus',
  plan_source = 'reconciliation',      -- keeps them OUT of the founding counter
  plan_started_at = coalesce(plan_started_at, now())
where lower(email) = 'user@example.com';
```

- `plan_source = 'dodo_webhook'` → counts as a real paying founding member
- `plan_source = 'reconciliation'` → team / gift / admin grant; excluded from `getFoundingCount()`

If the user hasn't signed in yet (no row), tell them to sign in via Clerk first, then re-run the query.

### Revoke Cue+ (refund)

```sql
update user_profiles
set plan = 'free', plan_source = null, plan_expires_at = null
where lower(email) = 'user@example.com';
```

Also refund on Dodo dashboard.

### Migrate a user's plan to a new email (they lost access to old email)

```sql
update user_profiles
set email = 'new@example.com'
where lower(email) = 'old@example.com';
```

### See all Cue+ founding members (real, excluding team)

```sql
select email, plan, plan_source, plan_started_at
from user_profiles
where plan = 'cue_plus'
  and plan_source not in ('reconciliation', 'manual_link_dodo_email_mismatch')
  and lower(email) not in (
    'aloks.int@teachforindia.org',
    'akashkumar7653099@gmail.com',
    'srivastavaalok2214@gmail.com'
  )
order by plan_started_at desc;
```

### Founding count (matches the pricing card counter)

```sql
select count(*) as founding_count
from user_profiles
where plan = 'cue_plus'
  and plan_source not in ('reconciliation', 'manual_link_dodo_email_mismatch')
  and lower(email) not in (
    'aloks.int@teachforindia.org',
    'akashkumar7653099@gmail.com',
    'srivastavaalok2214@gmail.com'
  );
```

### Poll dashboard queries

Contact info captured by the founding poll (v3):
```sql
select free_text, created_at
from poll_responses
where poll_id = 'founding-signal-v3:contact'
  and free_text is not null
order by created_at desc;
```

Full category breakdown of the library:
```sql
select 
  coalesce(nullif(category, ''), '(no category)') as category,
  count(*) as total,
  count(*) filter (where tier = 'free') as free,
  count(*) filter (where tier = 'premium') as premium
from prompts
group by category
order by total desc;
```

### Fix a broken thumbnail / video URL

```sql
update prompts
set hover_src = 'https://pub-bffac370ca114a6f873486297600ac6f.r2.dev/<new-key>.mp4'
where id = 'cue056';
```

### Migrate any remaining Cloudinary URLs (after checking count)

```sql
-- Audit first
select count(*) filter (where hover_src ilike '%cloudinary%') as cloudinary_hover,
       count(*) filter (where hover_src ilike '%r2.dev%') as r2_hover,
       count(*) as total
from prompts;
```

If `cloudinary_hover > 0`, run:
```bash
node scripts/migrate-cloudinary-to-r2.js --run
```

### Add / edit a prompt

Use the **admin UI** at `/admin` — that path handles thumbnail upload, tags, tier, prompt content etc. Never edit prompts via SQL unless fixing a specific broken field, because thumbnails and hover videos live in R2 and the UI keeps them in sync.

### Ban / soft-remove a spammer

```sql
-- Wipe feedback rows from that email
delete from feedback where lower(email) = 'spammer@example.com';

-- Downgrade if they had a plan
update user_profiles
set plan = 'free', plan_source = 'banned', plan_expires_at = now()
where lower(email) = 'spammer@example.com';
```

For DPDP compliance, if a user requests deletion:
```sql
delete from feedback where user_id = '<clerk_id>';
delete from poll_responses where session_id in (
  select session_id from poll_responses where free_text ilike '%<their-email>%'
);
delete from user_profiles where user_id = '<clerk_id>';
```
Confirm to them by email that data is deleted. Also delete on Clerk dashboard so their account is gone.

---

## 15. Emergency procedures

### Prod is down

1. **Vercel Deployments** → last row status. If `Error`, click into it → build logs → find the failure line.
2. If it's a code error: revert to last known-good commit
   ```bash
   git revert HEAD
   git push final main
   ```
3. If it's a Vercel-side outage: nothing to do — wait it out, status at status.vercel.com

### Database is read-only (Supabase pause)

Happens on the Free plan when quotas cross. Cue is on **Pro** now, so this shouldn't happen with Spend Cap OFF. If it does:
- Supabase dashboard → Settings → Billing → check current usage
- Turn Spend Cap OFF if not already
- Pro tier absorbs the overrun; bill appears next cycle

### Payment webhook is failing

Symptoms: user pays, but their profile stays on `free`. Fix path:
1. Dodo dashboard → Webhooks → Delivery logs → look for the failed event
2. If `dodo-webhook` returned 5xx: check Supabase Function logs
3. Manual grant as a stopgap:
   ```sql
   update user_profiles set plan = 'cue_plus', plan_source = 'manual_link_dodo_email_mismatch',
     plan_started_at = now(), dodo_customer_id = '<from dodo dashboard>'
   where lower(email) = '<buyer email>';
   ```
4. Redeploy `dodo-webhook` with the fix; Dodo will retry stalled events automatically.

### R2 storage nearing quota

Alert fires at 8 GB. If it does:
- Check R2 dashboard → bucket → Metrics
- Run `node scripts/optimize-r2-videos.js --run` to compress any un-optimized files
- If storage genuinely growing (150+ MB / month), upgrade R2 to paid ($0.015/GB/month) — cheapest storage on the market anyway

### Someone reported a security issue

- Take screenshots of the report and any repro steps
- If it's active exploitation (auth bypass, RLS gap), disable the affected surface immediately by:
  - Editing the edge function to return 503 and redeploying, OR
  - `alter policy ... using (false)` on the affected table to force-deny
- Fix in a branch, test locally, ship
- Rotate any leaked keys (Supabase → Settings → API → Reset keys)

---

## 16. Analytics

### PostHog
- Autocapture + session recordings on
- Named events in `src/lib/analytics.js`:
  - `sign_in_clicked`, `sign_in_completed`
  - `prompt_opened`, `prompt_copied`
  - `daily_limit_hit`
  - `founding_checkout_clicked`, `founding_purchase_completed`
  - `waitlist_joined`, `feedback_submitted`
- These dual-fire to Google Analytics 4 via the same `track()` wrapper.

### GA4
- Measurement ID: `G-DCG766G2YT`
- Loaded via `gtag.js` in `index.html` (Enhanced Measurement on — auto-tracks scroll, outbound clicks)
- Custom events land under **Reports → Events**

### Admin polls dashboard
`/admin/polls` — reads `poll_responses`, groups by `session_id`, shows Q1 / Q2 / Q3 / contact per session. Also renders a per-row **Send** button that opens a `mailto:` draft (or `https://x.com/<handle>` for X-handle contacts) prefilled with a founder-voice message keyed off the respondent's poll answers.

---

## 17. SEO

### Sitemap
- Auto-generated at build time (`scripts/generate-sitemap.js`)
- 126 URLs today: 7 static routes + 119 per-prompt entries
- Submitted to Google Search Console — status Success, 126 discovered pages

### robots.txt
Allow-all — AI answer engines (ChatGPT, Claude, Perplexity, Gemini, Copilot) are explicitly welcome. Being *recommended by AI* is the top-of-funnel that matters.

### Meta tags
- Title: `Cue — Awwwards-tier UI components for builders` (47 chars, fits Google)
- Description: 118 chars, matches search snippet limit
- Open Graph + Twitter Cards set with `og-image.png` (1200x630)
- JSON-LD structured data: Organization, WebSite, Product, FAQPage — all in `index.html`

### llms.txt
Live at `/llms.txt` and `/llms-full.txt` for AI crawlers to read as canonical content. Update whenever the value prop / pricing changes.

### Future SEO work
- **BrowserRouter migration** — currently hash routes consolidate on Google, so only the homepage is fully indexed. Real routes would unlock 119 per-component landing pages. ~1 hour of work, 48 links to update across 14 files.
- **Prerender** via `vite-plugin-ssg` — static HTML per route so each has correct meta tags.
- **Backlink push** — Product Hunt, Reddit (r/webdev, r/SideProject, r/reactjs), Awesome-lists on GitHub.

---

## 18. Automation (GitHub Actions)

`.github/workflows/optimize-videos.yml` — runs every 30 minutes on GitHub-hosted runners:
1. Checkout repo
2. Install ffmpeg
3. `node scripts/optimize-r2-videos.js --run`

The script is idempotent (uses R2 metadata tag `cue-optimized: 1` to skip already-processed files), so only fresh admin uploads get touched. Zero manual work.

If a run fails:
- Actions tab → the failed run → optimize job → Run optimizer step
- Most common failure: missing R2 secrets in repo settings (see [§4](#4-environment-variables))

---

## 19. Support & external accounts

Contact channels:
- **Public email**: hello@cuedesign.space (ImprovMX → Alok's Gmail)
- **X**: @Alok619308 — DMs open
- **Founder email (private)**: aloks.int@teachforindia.org

External services (dashboards to bookmark):
- **Vercel** — https://vercel.com/dashboard (project: cue-final-build)
- **Supabase** — https://supabase.com/dashboard/project/rkinvrdjbmoozjzmqshn
- **Cloudflare** — https://dash.cloudflare.com (R2 bucket + notification alerts)
- **Clerk** — https://dashboard.clerk.com
- **Dodo Payments** — https://app.dodopayments.com
- **PostHog** — https://app.posthog.com
- **Google Analytics** — https://analytics.google.com (property: Cue, G-DCG766G2YT)
- **Google Search Console** — https://search.google.com/search-console (property: cuedesign.space)
- **ImprovMX** — https://improvmx.com (email forwarding)
- **GitHub** — https://github.com/aloksivastava1025-prog/Cue_Final_build

---

## 20. Future roadmap

### Immediate (next 1–2 weeks)
- [ ] Product Hunt launch (Wed–Fri slot)
- [ ] Reddit outreach across r/webdev, r/SideProject, r/reactjs, r/UI_Design
- [ ] Awesome-list GitHub PRs (`awesome-react`, `awesome-tailwind`)
- [ ] BrowserRouter migration → per-component SEO surface
- [ ] Ship `code` field for the top 10 components → MCP has real code to serve

### Post-launch (weeks 3–6)
- [ ] MCP server v0.1 (`@cue/mcp` on npm) — scaffold already in `mcp/`
- [ ] `mcp-get-component` edge function with plan gating
- [ ] `mcp_api_keys` table + admin-only key issuance
- [ ] Prerender via vite-plugin-ssg
- [ ] Content posts (5–10 long-tail keywords)
- [ ] Bing Webmaster Tools setup

### Deferred (v0.2+)
- Composition endpoint (multi-component page recipes)
- Screenshot → matching component (vision input)
- Code adaptation to user's design tokens (Blend Contract in prompt)
- Taste-ranking model trained on Cue+ user signals
- Full-team plan (Cue+ Team) with seat management

---

## 21. Component authoring standard — HTML-first

The rule set below is the canonical pattern for every new Cue component. It exists because a real buyer (Marco, Sep 2 2026) called out that JS-array-driven components are hostile to agency workflows — clients on Webflow / WordPress / Framer can't update copy without pinging the developer. HTML-first also happens to be the most portable delivery format: same file lands cleanly in Webflow, Framer, WordPress, Next.js, or vanilla HTML with zero rewrites.

### Why HTML-first

- **Framework-agnostic delivery** — one file works everywhere. AI tools (Cursor, v0, Bolt) handle the HTML → React / Vue / Svelte conversion downstream. Cue doesn't need to ship four variants.
- **CMS-friendly by default** — content lives in markup, not code. Client editing = editing HTML in their CMS, no dev round-trip.
- **Reusable by structure** — same script animates any number of `.slide` elements. Add / remove content without code change.
- **Marketing differentiator** — Aceternity / Magic UI ship React-only. Cue's positioning is now "drop into any site." Real edge.

### The 3-part file structure

Every component ships as one self-contained HTML file:

```html
<!-- 1. Scoped styles — use CSS variables for tokens -->
<style>
  .cue-thing {
    --accent: #0000FF;
    --serif: "Fraunces", serif;
    --rhythm: 24px;
  }
  .cue-thing .element {
    color: var(--accent);
    font-family: var(--serif);
    padding-block: var(--rhythm);
  }
</style>

<!-- 2. HTML content — CMS-editable, semantic -->
<section class="cue-thing">
  <article class="item">
    <img src="/img1.jpg" alt="">
    <h3>Editable title</h3>
    <p>Editable body</p>
  </article>
  <!-- Add / remove articles freely; script auto-picks up -->
</section>

<!-- 3. Vanilla JS — reads content, doesn't own it -->
<script>
  const items = document.querySelectorAll('.cue-thing .item');
  items.forEach((item, i) => {
    // Animation, interaction, physics — NOT content
  });
</script>
```

### Rules — content in HTML

1. **No JS arrays of content.** Nothing like `const slides = [{title: "..."}]`. Content is inside `<article>` / `<li>` / `<section>` elements in the HTML.
2. **Semantic elements** — `<article>`, `<section>`, `<figure>`, `<blockquote>` instead of `<div>` where possible. Screen readers + CMS parsers both benefit.
3. **`data-*` attributes** for machine-readable state — `data-index`, `data-active`, `data-color` — not for content strings.
4. **Alt text on every `<img>`** — accessibility + SEO baseline.

### Rules — CSS

1. **Scoped by root class** — every rule starts with `.cue-thing` so the component can't leak into the host site's styles.
2. **CSS variables for tokens** — every color, font, spacing, easing uses `var(--xxx)`. Buyer overrides them via their brand tokens.
3. **Fixed motion values** — the easing curve and duration of the signature interaction are hardcoded (this is Cue's aesthetic). Colors / spacing swap; motion doesn't.
4. **Mobile-first media queries** — base styles for phone, `@media (min-width: 768px)` for desktop.

### Rules — JS

1. **Query, don't own.** Script uses `document.querySelectorAll('.item')` to find content. Never generates content.
2. **Vanilla JS by default.** No React, no framework — the file must run in an HTML page directly.
3. **`IntersectionObserver` for scroll-triggered work** — never bind to raw `scroll` events (perf killer).
4. **Idempotent init** — the script must handle a) DOM already present, b) items added after load. Use `MutationObserver` when content is CMS-injected post-load.

### When to break the pattern

Not every component is data-driven. Some are single-interaction primitives — a magnetic button, a cursor effect, a hover-morph card. For those:

- **The component IS the animation** — there's nothing to CMS-ify.
- Ship a single `.html` (or `.tsx`) file with the interaction; skip the HTML content section entirely.
- Note this in the prompt: "Single-interaction — no data pattern."

Roughly 40% of Cue is this category today (see the Sep 2 audit).

### React variant (optional, on request)

For buyers building React apps, ship a slot-based wrapper that keeps the same content-in-JSX pattern:

```jsx
export function Thing({ children }) {
  const ref = useRef(null);
  useEffect(() => {
    const items = ref.current.querySelectorAll('.item');
    // same animation logic
  }, []);
  return <section ref={ref} className="cue-thing">{children}</section>;
}

// Usage — content stays outside the component
<Thing>
  <article className="item">
    <img src={cmsData.image} alt="" />
    <h3>{cmsData.title}</h3>
  </article>
</Thing>
```

Content stays outside the component → CMS-editable → same semantics as the HTML version.

### Blend contract (adaptation rules) — always in the prompt

Every component prompt ends with an adaptation contract so the buyer's AI (Cursor / v0 / Bolt) knows what's safe to swap vs what's locked:

```
ADAPTATION CONTRACT

Preserve (do not change):
- Motion easing: cubic-bezier(0.22, 1, 0.36, 1)
- Duration: 400ms
- Vertical rhythm: 24px
- Aspect ratio: 16 / 10

Safe to swap:
- Primary color (--accent) → your brand primary
- Font family (--serif, --sans) → your fonts
- Border radius (--radius) → your radius scale

Reject if asked:
- Removing scoping class
- Replacing vanilla JS with jQuery / heavy library
- Hardcoding content into JS
```

### Migration — existing 5 JS-array components

The Sep 2 audit flagged 5 components using JS-array data (cue058, cue060, cue075, cue100, cue104). These get rewritten under this standard within two weeks of the standard landing. New submissions follow it from day one.

### Request shortcuts when asking Claude for a component

- `Cue prompt for [name] — [description]` — returns the AI prompt only
- `Cue prompt for [name] with code` — prompt + full HTML file
- `Cue html for [name]` — HTML file only, no prompt
- `Cue html + react for [name]` — both HTML and React variants
- `Cue prompt for [name] — single interaction` — animation-only, no data pattern
- `Cue prompt for [name] — CMS friendly` — force the HTML-first data pattern (default anyway)

---

## Meta: how to update this handbook

- One canonical file: `HANDBOOK.md` in the repo root.
- When you change infrastructure, a runbook, or a schema — update the relevant section in the same commit.
- The commit message should reference this file so future greps land here first.
- Don't split into multiple docs; one file the AI reads end-to-end beats a folder that fragments the context.

Last major update: September 1, 2026.
