# FINAL_LAUNCH_CHECKLIST

**Everything code-side is done.** Below is what stands between the
current commit and public launch. Ordered so each step unblocks the
next — don't reorder.

Legend
- 👤 = you do it (accounts, cards, DNS)
- 🤖 = I do it (code changes) once you hand me the value
- ⏱️ = rough time
- 💰 = money required
- 🔗 = link where to go

---

## Section 1 — Domain (unblocks everything)

- [ ] 👤 💰 ~₹1,000 ⏱️ 10 min
  **Buy `cuedesign.space`** on **[Cloudflare Registrar](https://dash.cloudflare.com/sign-up)**.
  1. Sign up / log in
  2. Domain Registration → search `cuedesign.space`
  3. Add card in Billing → Purchase (1 year, auto-renew ON)
  4. Send me the confirmation screenshot when done.

  If `cuedesign.space` isn't available or costs > $30/year, fallback to
  `cueui.com` (~$10 on Cloudflare). Tell me the actual domain — I'll
  do a global find-replace across the code.

---

## Section 2 — Third-party accounts (parallel to Section 1)

- [ ] 👤 ⏱️ 3 min · Free
  **Vercel account** — [vercel.com/signup](https://vercel.com/signup). Sign up with GitHub — will need to connect the `Cue_Final_build` repo later.

- [ ] 👤 ⏱️ 3 min · Free
  **Resend account** — [resend.com/signup](https://resend.com/signup). Free tier is 3,000 emails/month.

- [ ] 👤 ⏱️ 10 min · Free
  **Clerk production instance** — [dashboard.clerk.com](https://dashboard.clerk.com).
  1. Top-left dropdown → **Create production instance**
  2. Domain = your new domain (`cuedesign.space` or fallback)
  3. Under **Google OAuth** → copy the redirect URI Clerk gives you
  4. Google Cloud Console → OAuth 2.0 → add that redirect URI to the production credentials
  5. Note the new **publishable key** (`pk_live_...`) — I'll need it for Vercel env vars

- [x] ✅ Done
  **PostHog** — already set up with a key. Just need to add to Vercel env.

- [x] ✅ Done
  **Cloudflare account** — you'll be there for the domain anyway.

---

## Section 3 — Once domain is bought (hand me the domain string)

- [ ] 🤖 ⏱️ 5 min
  **Global find-replace** — I'll replace every `cuedesign.space` in:
  - `index.html` (og:url, canonical, JSON-LD)
  - `public/sitemap.xml`
  - `public/robots.txt`
  - CORS allowlists in 9 edge functions

- [ ] 👤 ⏱️ 5 min · Free
  **Resend — add domain**
  1. Resend → Domains → **Add Domain** → paste `cuedesign.space`
  2. Resend gives 3 DNS records (MX + SPF + DKIM)
  3. Cloudflare dashboard → your domain → **DNS** tab → **Add record** for each of the 3 (copy exact name + value)
  4. Wait 5–30 min → Resend → **Verify** → green checkmark
  5. Send me the domain-verified confirmation screenshot

- [ ] 👤 ⏱️ 1 min
  **Resend API key**
  1. Resend → API Keys → **Create API Key** → name it `CUE Production` → permission `Sending access`
  2. Copy the `re_...` key, paste to me → I'll set it in Supabase secrets

- [ ] 🤖 ⏱️ 30 min
  **Wire Resend into edge functions**
  1. `send-contact` — forward customer messages to `hello@cuedesign.space`
  2. `dodo-webhook` — welcome email on payment.succeeded (uncomment the TODO block)
  3. Optional: waitlist confirmation email

---

## Section 4 — Deploy to Vercel

- [ ] 👤 ⏱️ 10 min · Free
  **Import repo to Vercel**
  1. Vercel dashboard → **Add New Project** → import `Cue_Final_build` from GitHub
  2. **Framework preset:** Vite (auto-detected)
  3. **Build command:** `npm run build` (default)
  4. **Output directory:** `dist` (default)
  5. Don't deploy yet — add env vars first

- [ ] 👤 ⏱️ 3 min
  **Vercel env vars** — Project Settings → Environment Variables. Set for all three scopes (Production, Preview, Development):

  ```
  VITE_CLERK_PUBLISHABLE_KEY  = <pk_live_... from Clerk production instance>
  VITE_SUPABASE_URL           = https://rkinvrdjbmoozjzmqshn.supabase.co
  VITE_SUPABASE_ANON_KEY      = <from .env — copy over>
  VITE_SENTRY_DSN             = https://8f657328e28c80c5b8cf4375de9c4dca@o4511919000190976.ingest.us.sentry.io/4511919025029120
  VITE_POSTHOG_KEY            = phc_z8mJbSTzqi8a5CYwjCnQXkkXgcE6CaJ8mSTtGNz3Gpvr
  VITE_POSTHOG_HOST           = https://us.i.posthog.com
  VITE_USE_CLERK_SUPABASE_JWT = false
  ```

- [ ] 👤 ⏱️ 2 min
  **Deploy** — Vercel dashboard → **Deploy**. Wait ~90 seconds. First deployment URL will be `cue-final-build-<hash>.vercel.app`. Verify it loads.

- [ ] 👤 ⏱️ 5 min
  **Add custom domain**
  1. Vercel → Project → Settings → Domains → **Add** → paste `cuedesign.space`
  2. Vercel gives DNS records
  3. Cloudflare DNS → add those records
  4. Wait for SSL to provision (~2 min)
  5. Open `https://cuedesign.space` — site should load

---

## Section 5 — Dodo live-mode flip

- [ ] 👤 ⏱️ 10 min
  **Live product + webhook**
  1. Dodo Dashboard → toggle **Live mode** (top of dashboard)
  2. **Products** → Create → `Cue+ Founding Lifetime` — $99 one-time — note the new `pdt_...` id
  3. On the product → **Return URLs**:
     - Success = `https://cuedesign.space/#/billing/success`
     - Cancel = `https://cuedesign.space/#/billing/cancel`
  4. **Webhooks** → Add endpoint → `https://rkinvrdjbmoozjzmqshn.supabase.co/functions/v1/dodo-webhook`
  5. Copy the new webhook signing secret (`whsec_...`)
  6. Send me all 3 (new product id, new API key, new webhook secret)

- [ ] 🤖 ⏱️ 2 min
  **Supabase secret swap** — I'll update:
  ```
  DODO_PAYMENTS_API_KEY               = <new live key>
  DODO_WEBHOOK_SECRET                 = <new live signing secret>
  DODO_PRODUCT_ID_INDIVIDUAL_LIFETIME = <new live product id>
  DODO_ENV                            = live
  ```

---

## Section 6 — Clerk production keys

- [ ] 👤 ⏱️ 3 min
  **Clerk webhook**
  1. Clerk dashboard (production instance) → **Webhooks** → Add endpoint
  2. URL = `https://rkinvrdjbmoozjzmqshn.supabase.co/functions/v1/clerk-webhook`
  3. Subscribe to `user.deleted` (for DPDP right-to-erasure)
  4. Copy the signing secret

- [ ] 🤖 ⏱️ 1 min
  **Supabase secret** — I'll set `CLERK_WEBHOOK_SECRET` to the new value.

---

## Section 7 — First real live purchase (final smoke test)

- [ ] 👤 ⏱️ 5 min · 💰 $99 (refundable to yourself)
  Buy your own founding spot with a real card.
  1. Open `https://cuedesign.space` in an incognito window (fresh state)
  2. Sign in with a spare email
  3. `#/pricing` → **Claim founding spot**
  4. Dodo checkout → real card → complete payment
  5. Auto-redirect to `/#/billing/success` → wait 10 s → "Welcome to Cue+"
  6. Click **Download invoice** → PDF opens
  7. Under avatar → **Billing & invoices** → invoice history shows the purchase
  8. Try a premium prompt → paywall gone
  9. Screenshot everything and send to me

- [ ] 👤 ⏱️ 2 min
  **Refund yourself** in Dodo dashboard → verify plan reverts to `free` within 30 s. Confirms refund attribution fix works in live mode.

- [ ] 👤 ⏱️ 2 min
  **Verify PostHog** — dashboard → **Web analytics** → your session should be there. Session Replay should have your recording.

---

## Section 8 — Announce

- [ ] 👤
  **Twitter / X thread** — the founding-50 pitch. Link `https://cuedesign.space`.
- [ ] 👤
  **Product Hunt** launch (optional — set date + prep hunter).
- [ ] 👤
  **Cold email to designer friends / early users** — 20 personal notes beats one broad blast.

---

## Section 9 — Post-launch queue (nice to have, not blockers)

Not needed for launch. Do these in the first month:

- [ ] Content push from 46 → 60 prompts
- [ ] PNG version of `og-image.svg` (Twitter cards need PNG for thumbnail)
- [ ] Weekly newsletter automation via Resend
- [ ] Turnstile CAPTCHA on waitlist + feedback forms
- [ ] Clerk JWT verification on `create-checkout` / `get-invoice` / `get-my-billing` edge fns
- [ ] Slack/email alerting on Sentry errors
- [ ] Dodo `payment.failed` + `dispute.opened` handlers
- [ ] Admin resync UI (currently just SQL Editor)
- [ ] Move admin emails from hardcoded to env var
- [ ] `VITE_USE_CLERK_SUPABASE_JWT=true` + run `supabase-migration-security-lockdown.sql` (RLS full lockdown)
- [ ] Local Node 16 → 20 upgrade (Vercel builds are fine on Node 20 by default; this is only a local dev annoyance)

---

## The one thing on the critical path

**Buy the domain.** Everything else is either waiting on the domain
(Resend, Vercel custom domain, Clerk production, Dodo return URLs)
or already done (code, DB, edge functions, tests).

Ping me the moment `cuedesign.space` (or fallback) is in your Cloudflare
dashboard — I'll do the global find-replace and walk you through
Section 4 onward.
