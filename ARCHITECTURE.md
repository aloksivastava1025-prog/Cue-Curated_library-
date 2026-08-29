# Cue — Architecture Document

**Last updated:** 2026-08-29  
**Repo:** `Cue_Final_build` (branch: `main`)  
**Prod URL:** [cuedesign.space](https://cuedesign.space)

Cue is a curated component-prompt library for AI-native builders (Cursor / v0 / Bolt / Framer). This document is the "if the bus hits me tomorrow" reference — every tech decision, where it lives, and why.

---

## 1. TL;DR — one paragraph

React SPA (Vite) → Vercel. State + browse from **Supabase Postgres**, auth via **Clerk**, payments via **Dodo Payments** (routed through a Supabase Edge Function that stamps `metadata.user_id` before Dodo ever sees the request). Anon browse-limits + coupon state live in `localStorage`. Analytics: PostHog + Vercel Web Analytics + Sentry.

---

## 2. Tech Stack

| Layer | Tech | Why |
|---|---|---|
| **Frontend framework** | React 18.3 | Widest ecosystem; the components we ship are React source |
| **Build / dev** | Vite 5 | Fast HMR, ESM-native, no config drama |
| **Routing** | Custom hash-based (`#/pricing`, `#/admin`) — no react-router | Zero-dep, works on static Vercel hosting without rewrite rules |
| **Styling** | Inline styles + CSS variables + a few `<style>` blocks | Small runtime, no CSS-in-JS bill, dark-theme via `--*` vars |
| **State** | React `useState` / `useEffect` + one `AppContext` | Deliberately no Redux/Zustand — the app is thin |
| **Smooth scroll** | Lenis 1.3 | Awwwards-tier scroll feel; note: suppresses native scroll events |
| **Auth** | Clerk (React SDK 5.61) | Free tier, drop-in UI, JWT to Supabase |
| **DB** | Supabase Postgres (project `rkinvrdjbmoozjzmqshn`) | Postgres + Storage + Edge Functions in one |
| **Serverless** | Supabase Edge Functions (Deno) | Bundled with DB; service-role never touches the browser |
| **Payments** | Dodo Payments (Merchant of Record) | INR + USD, handles tax, Klarna/GPay/Apple Pay/Card |
| **Media** | Supabase Storage (bucket `prompts`) — migration to R2 planned | Egress cap is the reason for the R2 move |
| **Analytics** | PostHog + Vercel Web Analytics | PostHog for events + session replay; Vercel for cheap page-view stats |
| **Error monitoring** | Sentry (`@sentry/react` 10.70) | Auto-captures the ErrorBoundary + fetch failures |
| **Email** | Resend (via `send-*` edge functions) + ImprovMX (`hello@cuedesign.space` forwarding) | Resend for transactional; ImprovMX for a free receive-only mailbox |
| **Hosting** | Vercel | `main` push auto-deploys |

Dev dependencies of note: `papaparse` (CSV import for the `prompts` table), `pg` (data-migration scripts, not runtime).

---

## 3. Repository Layout

```
cue_lib/
├── src/
│   ├── App.jsx                    # Route dispatch + hero + grid + AppShell (~1800 lines)
│   ├── main.jsx                   # ClerkProvider + AppProvider + AuthProvider + ErrorBoundary boot
│   ├── index.css                  # Global CSS variables + resets
│   ├── components/
│   │   ├── Card.jsx / CardThumb.jsx      # Grid tile + image/video windowing (IntersectionObserver)
│   │   ├── EditorialCard.jsx             # Featured/hero-style cards
│   │   ├── FoundingPoll.jsx              # Dynamic-island 3-step branching survey (~950 lines)
│   │   ├── FounderDock.jsx               # Bottom-right founder avatar + hidden coupon hint
│   │   ├── WelcomeCard.jsx               # Show-once landing card with live coupon timer
│   │   ├── CouponTimer.jsx               # Subtle 24h ticker under hero
│   │   ├── FeedbackModal.jsx             # In-app feedback (posts to Supabase)
│   │   ├── UserInbox.jsx / AdminInbox    # Admin ↔ user message thread
│   │   ├── SignInCard.jsx                # Clerk sign-up/in modal
│   │   ├── FilterBar / FilterMenu / TagFilter / TierFilter
│   │   ├── Nav / NavMenu / FloatingNav / Footer
│   │   ├── Hero / FeaturedRail / Rail / Search
│   │   ├── Modal / Toast / EmptyState / ErrorBoundary
│   │   ├── WaitlistCTA / MonthlyWaitlistModal / OnboardingCard
│   │   └── CueUserMenu.jsx               # Clerk-user dropdown
│   ├── pages/
│   │   ├── Pricing.jsx                   # $99 lifetime + $49 monthly + CUE49 input
│   │   ├── Billing.jsx                   # /billing/success + user's billing history
│   │   ├── Saved.jsx                     # Bookmarked components
│   │   ├── Admin.jsx                     # Admin landing (links to sub-panels)
│   │   ├── AdminInbox.jsx                # Compose message to user
│   │   ├── AdminPolls.jsx                # FoundingPoll response dashboard
│   │   ├── AdminSubscriptions.jsx        # Active Cue+ list + CSV/JSON export
│   │   ├── Contact.jsx / Legal.jsx / NotFound.jsx
│   ├── hooks/
│   │   ├── useAuth.jsx                   # authOpen modal state + openAuth('sign-in'/'sign-up')
│   │   ├── useOnboarding.js              # First-time user setup flow
│   │   ├── usePageMeta.js                # <title>/OG per route
│   │   ├── useClipboard.js               # Copy-to-clipboard toast wrapper
│   │   └── useScrollDirection.js         # Header hide/show
│   ├── context/
│   │   └── AppContext.jsx                # feedbackOpen, welcome state, global UI flags
│   ├── lib/
│   │   ├── backend.js                    # Single Supabase-facing API surface (getPrompts, createFoundingCheckout, listActiveSubscriptions…)
│   │   ├── supabase.js                   # Anon client (VITE_SUPABASE_ANON_KEY)
│   │   ├── analytics.js                  # PostHog wrapper + typed `events` object
│   │   ├── sentry.js                     # Sentry init
│   │   ├── media.js                      # Video/img windowing helpers
│   │   ├── promptHelpers.js              # `toJs` row → client shape mapper
│   │   └── friendlyError.js              # Error → user-facing string
│   └── data/
│       └── prompts.js                    # Static seed / demo prompt list
├── supabase/
│   ├── config.toml                       # Local supabase CLI project link
│   └── functions/                        # See §5 below
├── supabase-migration-*.sql              # 20+ raw migration files (source of truth for schema)
├── public/                               # Static assets, llms.txt
├── package.json                          # Vite + React + Clerk + Supabase + Sentry
├── vite.config.js
├── vercel.json                           # Rewrites so hash routes work
└── (untracked side projects: code-peek-extension/, virtual-tryon/, engati_builder/, etc.)
```

---

## 4. Data Layer — Supabase

### 4.1 Client access

`src/lib/supabase.js` creates one anon client. Everything read-only from the browser uses it. Anything privileged goes through an Edge Function (§5).

### 4.2 Tables (from migration files)

| Table | Purpose |
|---|---|
| `prompts` | The library — one row per component (id, title, description, category, tags, tier, thumb_src, hover_src, view_count, like_count, code, source_credit) |
| `prompt_contents` | Prompt text stored separately from `prompts` for gating (paid rows have prompt only if user is Cue+) |
| `user_profiles` | user_id (Clerk), email, plan (`free` \| `cue_plus` \| `cue_plus_team`), plan_source, plan_started_at, plan_expires_at, dodo_customer_id, dodo_subscription_id, team_seats |
| `waitlist` | Newsletter / waitlist email captures |
| `monthly_waitlist` | Separate list for monthly plan interest |
| `feedback_messages` | In-app feedback submissions |
| `admin_inbox` | Bi-directional admin ↔ user thread |
| `poll_responses` | FoundingPoll survey answers (session_id + q1/q2/q2b/q3/contact) |
| `daily_copy_limits` / `monthly_copy_cap` | Free-tier prompt-copy rate limits |
| `rate_limit_windows` | Generic rate-limit windows (used by create-checkout etc.) |
| `component_views` | View counter (populated by `record-view` edge function) |
| `user_onboarding` | First-run setup state |

RLS is **on** for all user-scoped tables — see `supabase-migration-security-lockdown.sql`. Anon can read `prompts` metadata and public content; anything user-owned requires a valid Clerk JWT via Supabase's OAuth adapter.

### 4.3 Storage

Bucket `prompts` — thumb + hover MP4s / WebPs. Direct public URL. Egress is why Cloudflare R2 migration is on the backlog.

---

## 5. Edge Functions (Deno)

All under `supabase/functions/`. Deployed with `npx supabase functions deploy <name> --project-ref rkinvrdjbmoozjzmqshn`.

| Function | Purpose | Auth |
|---|---|---|
| `create-checkout` | Builds Dodo checkout session; stamps `metadata.user_id`; enforces founding-50 cap + rate limits; forwards `discount_code` (whitelist: `CUE49`) | Body-supplied Clerk userId (see below) |
| `dodo-webhook` | Grants / revokes plan on `payment.succeeded` / `subscription.active` / `refunded` | Verifies Dodo signature header |
| `clerk-webhook` | On `user.created` — inserts a `user_profiles` row | Verifies Clerk `svix` signature |
| `cancel-subscription` | Cancel-at-period-end for monthly plan | User must own the subscription |
| `get-invoice` | Signed-URL passthrough to Dodo invoice PDF | Owner-only |
| `get-my-billing` | User's own billing history + plan status | User-only |
| `record-view` | Increment `component_views.view_count` on card open | Anonymous OK — CORS + rate-limit |
| `autofill-metadata` | Fill `prompts.tags/description` via LLM (admin tool) | Admin-only |
| `send-signup-welcome` / `send-waitlist-welcome` | Resend transactional emails | Triggered from webhooks |
| `send-contact` / `send-admin-message` | Contact form + admin ↔ user reply | Rate-limited |
| `resend-diag` | Ping Resend to sanity-check the send stack | Admin-only |

### 5.1 Why `metadata.user_id` matters

Cue does not bridge Clerk JWTs into Supabase's row-level auth. Instead, `create-checkout` takes a body-supplied `userId` and stamps it into Dodo's `metadata`. When the Dodo webhook fires, `dodo-webhook` attributes the plan by that stamped `user_id` first, then falls back to email match. Spoofing is not a financial exploit — payer's real card is still charged; worst case is a $99 gift to a different Clerk account.

---

## 6. Auth — Clerk

- Dev instance + Live instance are separate (see `pk_test_` vs `pk_live_`).
- `main.jsx` wraps `<App />` in `ClerkProvider`. Sign-up / sign-in surfaced via `<SignInCard>` modal (`useAuth().openAuth('sign-up')`).
- **Clerk webhook** (`clerk-webhook`) creates the corresponding `user_profiles` row so the DB has an authoritative record on day 1.
- Only OAuth `google` enabled in production — `oauth_x` etc. are on the dev instance only.

### 6.1 Admin authorisation

Two allowlists in `src/pages/AdminSubscriptions.jsx`:

- `ADMIN_EMAILS` — accounts *excluded* from the founding-50 real-customer count.
- `PAGE_ADMIN_EMAILS` — accounts *allowed* to load admin panels. Includes founder's own gmail.

---

## 7. Payments — Dodo

Two Dodo API endpoints:

- **`/payments`** — one-time (lifetime + annual). Body uses `product_cart[]`.
- **`/subscriptions`** — recurring (monthly). Body uses `product_id` + `quantity`.

Product IDs live in Supabase env vars (never in source):

- `DODO_PRODUCT_ID_INDIVIDUAL_LIFETIME`
- `DODO_PRODUCT_ID_INDIVIDUAL_ANNUAL`
- `DODO_PRODUCT_ID_INDIVIDUAL_MONTHLY`
- `DODO_PRODUCT_ID_TEAM_ANNUAL`
- `DODO_PRODUCT_ID_TEAM_LIFETIME`
- `DODO_PAYMENTS_API_KEY`
- `DODO_ENV` (`live` or blank → test)

Currency: no `currency_options` on the API — Dodo's own **Localized Pricing By Country** does the FX. `buyerCountry` is detected client-side via Cloudflare trace (`fetch('https://www.cloudflare.com/cdn-cgi/trace')`).

### 7.1 CUE49 coupon system

- Coupon created on Dodo: **50% off**, applies to Cue+ Founding Lifetime only, redemption cap 50, per-customer cap 2, 7-day expiry.
- **On-site hunt:** WelcomeCard, hero pill live-ticker, FounderDock avatar gold pip + hint card, Pricing "?" tooltip — user discovers the code themselves.
- **Application:** Coupon input on `/pricing` under the founding CTA. User types `CUE49` → Apply → `backend.createFoundingCheckout({ couponCode })` → edge function whitelist check → Dodo pre-applies → checkout shows discounted total directly.
- **INR handling:** Percentage discount converts cleanly on Dodo's localised price (flat-USD had a broken FX). Coupon input shown for both currencies.

---

## 8. Client-side Routing (hash-based)

`App.jsx` reads `window.location.hash` and dispatches. Known routes:

| Route | Page |
|---|---|
| `#/` (default) | Home — hero + grid |
| `#/pricing` | Pricing |
| `#/billing` / `#/billing/success` | Billing history + post-Dodo return |
| `#/saved` | Bookmarks |
| `#/contact` | Contact |
| `#/legal` (etc.) | Legal pages |
| `#/admin` | Admin landing (allowlist-gated) |
| `#/admin/inbox` | Compose to user |
| `#/admin/subscriptions` | Active Cue+ subs + export |
| `#/admin/polls` | Poll responses |

Hash routing chosen so Vercel doesn't need per-route rewrites.

---

## 9. Key Flows

### 9.1 Anon browse → sign-up wall

- Grid shows **12** cards for anon users (`ANON_GRID_LIMIT` in `App.jsx`), then a "sign up to see all N" CTA.
- Anon can **open** 2 cards fully (`ANON_OPEN_LIMIT = 2`, counter in `localStorage: cue_anon_opens`). 3rd click opens sign-up.

### 9.2 Founding checkout

`Pricing.jsx` → `startFoundingCheckout()` → `backend.createFoundingCheckout(user, { couponCode })` → Supabase edge fn `create-checkout` → Dodo `/payments` → redirect. Dodo `payment.succeeded` webhook → `dodo-webhook` edge fn → `user_profiles.plan = 'cue_plus'`.

### 9.3 CUE49 hunt

On first render of *anything*, `cue.coupon.window.start` is set in `localStorage` — 24-hour clock starts. Hints scattered across the app share this timestamp. Applying the code on Pricing forwards it through create-checkout.

### 9.4 FoundingPoll

Dynamic-island survey at shell level (persists across route change).

- Q1 blocker → Q2 branch (need_more_components → Q2b ideal count → Q3, others → Q3) → Q3 commit → contact.
- Answers written to `poll_responses` per `session_id`.
- Admin sees the aggregate at `#/admin/polls`.

### 9.5 Admin insurance export

`#/admin/subscriptions` → **Export CSV** or **Export JSON** — dumps every row currently loaded in the panel as a file. Zero server call, works offline. Filename: `cue-founding-members-YYYY-MM-DD.csv`.

---

## 10. State & Storage (browser)

### `localStorage` keys

| Key | Purpose |
|---|---|
| `cue_anon_opens` | Anon card-open counter |
| `cue.welcome.shown_at` | WelcomeCard 3-hour revisit-quiet timestamp |
| `cue.coupon.window.start` | 24hr coupon-hunt window start (all timers read this) |
| `cue.coupon.unlocked` | JSON `{ at: <timestamp> }` — set when user found the code (was used by keyboard-typing discovery, dropped) |
| `cue.coupon.attempts` | Attempt counter (dropped along with typing discovery) |

### `sessionStorage`

- `cue.session_id` — persistent per-tab id for FoundingPoll deduping.

---

## 11. Analytics + Observability

| Tool | What |
|---|---|
| **PostHog** | Product events + session replay. Wrapped in `src/lib/analytics.js` — always call via `events.<name>(props)`, never direct `posthog.capture`. Identified as Clerk user on sign-in; reset on sign-out. |
| **Vercel Web Analytics** | `<VercelAnalytics />` mounted in AppShell. Enable toggle in Vercel dashboard. No cookies. |
| **Sentry** | `src/lib/sentry.js` init at boot. Auto-catches ErrorBoundary + fetch failures. |

Key events currently tracked: `founding_checkout_clicked`, `poll_answered_q1/q2/q3`, `prompt_copied`, `email_captured`, etc.

---

## 12. Environment Variables

### Client (Vite — `VITE_` prefix)

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_CLERK_PUBLISHABLE_KEY`
- `VITE_POSTHOG_KEY`
- `VITE_POSTHOG_HOST`
- `VITE_SENTRY_DSN`

### Server (Supabase Edge Functions)

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DODO_PAYMENTS_API_KEY`
- `DODO_ENV` (`live` or blank)
- `DODO_PRODUCT_ID_*` (5 variants)
- `DODO_WEBHOOK_SECRET`
- `CLERK_WEBHOOK_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Vercel gets the client keys; Supabase gets the server keys. No key is ever committed.

---

## 13. Deployment

- **Frontend:** `git push origin main` → Vercel auto-builds and deploys. Custom domain: `cuedesign.space` (root) + `www` redirect. ImprovMX forwards `hello@cuedesign.space` → founder inbox (free tier).
- **Edge functions:** `npx supabase functions deploy <name> --project-ref rkinvrdjbmoozjzmqshn`. No CI wiring yet — done manually per function.
- **DB migrations:** SQL files at repo root are the source of truth. Run manually in Supabase SQL Editor.

---

## 14. Known Backlog / Constraints

- **Cloudflare R2 migration** — Supabase Storage egress cap looming Sept 27, 2026. Move `prompts` bucket to R2 with signed URLs.
- **Dodo live-mode + Clerk prod instance** — full switch pending; test-mode has caught most edge cases.
- **Google Analytics 4** — alongside PostHog for marketing attribution (not yet added).
- **MCP server** (`mcp/` package — planned) — Cue library exposed to Cursor / Claude Desktop / Windsurf via MCP protocol. Spec in `.claude/plans/sleepy-hugging-swing.md`. Blocker: only `cue056` has `code` filled today — need code coverage first.
- **CI for edge functions** — currently manual `supabase functions deploy`. Consider a GitHub Action.
- **Real E2E tests** — Playwright not yet wired. Manual QA + PostHog replay covers most.

---

## 15. Non-goals (deliberate)

- **No CSS-in-JS.** Inline + CSS variables is enough at this scale.
- **No global state library.** `useState` + one Context does it.
- **No SSR / Next.js.** SPA works; SEO delta is not worth the complexity.
- **No react-router.** Hash routing is fine on a static host.
- **No per-user JWT bridge to Supabase RLS.** `metadata.user_id` in payments + email-match on webhooks is enough auth for a $99 launch.

---

## 16. If the founder gets hit by a bus

1. **Supabase project** — `rkinvrdjbmoozjzmqshn`. Owner: `aloks.int@teachforindia.org`. All data is there.
2. **Admin Export CSV** at `#/admin/subscriptions` — pulls every founding-member record without needing DB access.
3. **Dodo dashboard** — refunds, subscription cancellations, customer emails.
4. **Vercel + Clerk + Supabase** are all under the founder's Google-linked accounts.
5. **The codebase** is the runnable source of truth. `git clone` → `npm install` → env vars → `npm run dev`.

If everything else fails, `cue-founding-members-<date>.csv` in someone's Downloads folder is the roster.
