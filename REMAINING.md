# CUE — Remaining Work

> Everything not yet done, ranked by whether it blocks launch.
> Companion doc to [PROJECT.md](PROJECT.md).

Legend:
- 🔴 **P0** — blocks public launch. Cannot ship without.
- 🟠 **P1** — strongly recommended before launch. Impacts quality/safety.
- 🟡 **P2** — post-launch. Iterate after first users.
- 👤 **your action** — needs Alok's account setup or decision
- 💻 **my action** — needs code work

---

## 🔴 P0 — Launch blockers

### Infrastructure

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

### Security

- [ ] 👤 **Clerk JWT template setup** (5 min)
  - Clerk Dashboard → JWT Templates → New → "Supabase" preset
  - Name: exactly `supabase`
  - Claims: `sub`, `email`
  - Paste Supabase JWT secret
- [ ] 👤 **`VITE_USE_CLERK_SUPABASE_JWT=true`** on local `.env` + Vercel
- [ ] 👤 **Run `supabase-migration-security-lockdown.sql`** in Supabase SQL Editor
  - This kills 5 Critical + 1 High security issues in one shot
- [ ] 👤 **Verify migration** — see verification steps at bottom of migration file

### Payment (Dodo Payments)

- [ ] 👤 **Dodo Payments account** — signed up
- [ ] 👤 **Create 2 products in Dodo dashboard**
  - `CUE+ Individual — Lifetime` — $79 one-time
  - `CUE+ Team — Lifetime` — $249 one-time
  - Send me both `product_id` + `payment_link` URLs
- [ ] 💻 **Wire payment on Pricing page** — buttons open Dodo checkout
- [ ] 💻 **`user_profiles` table** — [`supabase-migration-user-profiles.sql`](supabase-migration-user-profiles.sql) already written, run in SQL editor
- [ ] 💻 **Clerk signup webhook** — on new user, insert into `user_profiles` with plan='free'
- [ ] 💻 **`dodo-webhook` edge function** — verify signature, mark user `plan='cue_plus'` on payment success
- [ ] 👤 **Set webhook URL in Dodo dashboard** — after edge function deployed
- [ ] 💻 **Entitlement check in Modal paywall** — signed-in user with `plan='cue_plus'` sees prompt, others see paywall
- [ ] 👤 **Test on Dodo test mode** — test card `4242 4242 4242 4242`

### Email delivery (Resend)

- [ ] 👤 **Resend signup** — US region
- [ ] 👤 **Domain verify** — add DNS records from Resend dashboard
- [ ] 👤 **Generate API key** — send it to me
- [ ] 💻 **Welcome email** — on Clerk signup webhook
- [ ] 💻 **Purchase confirmation email** — on Dodo webhook success
- [ ] 💻 **Feedback reply notification** — when admin replies, email user

### Anti-abuse

- [ ] 👤 **Cloudflare Turnstile signup** — free, 10 min
- [ ] 👤 **Get site + secret keys** — send site key to me, secret goes to edge function
- [ ] 💻 **Wire Turnstile widget** on waitlist form + feedback modal
- [ ] 💻 **Verify token server-side** in feedback / waitlist edge functions
- [ ] 💻 **Move `increment_view` behind edge function** — IP + session dedup

### Content

- [ ] 👤 **Push content: 38 → 55-60 items**
  - Each with tested prompt (Bolt/v0 verified)
  - Cover with no letterboxing
  - `use_case` filled
  - Correct `component_type` (section/interaction)
- [ ] 👤 **Curate featured rail** — 6-8 gold-standard items marked `rail='featured'`

---

## 🟠 P1 — Strongly recommended

### Brand + SEO

- [ ] 👤 **OG image 1200x630** — CUE wordmark + tagline on `#0A0A0A` background
  - Save as `public/og-cover.png`
  - Referenced automatically by `usePageMeta` hook
- [ ] 👤 **Better favicon** — currently basic SVG; consider Figma → 32x32 PNG + `apple-touch-icon`
- [ ] 👤 **Twitter/X account** created — link in Footer.jsx
- [ ] 👤 **Instagram / LinkedIn** (optional) — same

### Analytics

- [ ] 👤 **Choose: Plausible ($9/mo) or PostHog (free tier)**
- [ ] 👤 **Signup + get script snippet or API key**
- [ ] 💻 **Wire into `index.html` or React entry**
- [ ] 💻 **Track key events:** `card_open`, `prompt_copy`, `checkout_start`, `signup`, `subscribe`, `feedback_send`

### Legal review

- [ ] 👤 **Choice: lawyer review (~$100-300) OR Termly generator ($10/mo)**
- [ ] 👤 **If lawyer** — send them `src/pages/Legal.jsx` PAGES object
- [ ] 💻 **Replace draft banner** once reviewed — remove "lawyer review pending" yellow bar

### DPDP compliance

- [ ] 💻 **Clerk `user.deleted` webhook** — cascade delete rows across `user_profiles`, `prompt_bookmarks`, `prompt_likes`, `feedback`, `feedback_messages`

### Performance

- [ ] 👤 **Real iPhone Safari test** — DevTools mobile ≠ real Safari
- [ ] 💻 **Bundle analysis** — `vite-bundle-visualizer`, split chunks if needed
- [ ] 💻 **Lighthouse audit** — target ≥ 90 across all metrics
- [ ] 💻 **Preload critical fonts** — Fraunces + Geist only

### Error tracking

- [ ] 👤 **Sentry — switch to Developer (free) plan** after trial ends
  - Settings → Subscription → Change Plan → Developer
- [ ] 💻 **Verify PII scrubber works** — trigger a test error with an email in the message

### Vite upgrade

- [ ] 💻 **`npm audit fix --force`** — upgrades Vite 5 → 7 (major bump, needs testing)
- [ ] 💻 **Test dev server + dev proxy** after upgrade

---

## 🟡 P2 — Post-launch OK

### Features that grow value with scale

- [ ] 💻 **Search bar** — full-text over title + tags + description (grows in value >100 items)
- [ ] 💻 **Shareable item URLs** — `#/item/cue001` with proper OG per item
- [ ] 💻 **Related items** — modal footer shows 3 similar items by tag overlap
- [ ] 💻 **Copy count tracking** — telemetry: which prompts are copied most
- [ ] 💻 **Popularity ranking** — sort by view + like + copy

### Business moves

- [ ] 💻 **MCP server** — expose CUE library via Model Context Protocol (Claude Desktop, Cursor)
  - Biggest differentiator vs Osmo / 21st.dev
  - ~1 week of focused work
- [ ] 💻 **Weekly drops automation** — Resend cron: new items in past 7 days → newsletter to waitlist
- [ ] 💻 **Team plan seat management UI** — invite / revoke / transfer
- [ ] 💻 **Affiliate program** — 30% commission, ref-code URLs, dashboard

### Content pipeline

- [ ] 👤 **Newsletter template design** — hero image + 3-5 items + link
- [ ] 👤 **Product Hunt launch prep** — hero graphic, tagline drafts, comment script
- [ ] 👤 **Twitter/X launch thread** draft
- [ ] 👤 **1-2 case studies** — someone who built with CUE

### Awwwards-tier polish (from earlier discussion)

- [ ] 💻 **Bespoke cursor** — blob follower + interactive states (~1.5 hrs)
- [ ] 💻 **Text split-reveal on hero** — character-by-character stagger (~1 hr)
- [ ] 💻 **Grid stagger enter** — sequential fade-up on mount (~30 min)
- [ ] 💻 **Kinetic marquee** — "COPY · PASTE · SHIP" horizontal scroll banner (~1 hr)
- [ ] 💻 **Route transitions** — curtain reveal between pages (~2 hrs)
- [ ] 💻 **Ambient film grain overlay** — 3-5% opacity noise texture (~15 min)
- [ ] 💻 **Magnetic buttons** — subtle cursor pull on CTAs (~30 min)
- [ ] 💻 **Custom scrollbar** — 2px vertical line, fade in on scroll (~20 min)
- [ ] 💻 **Wordmark scroll-parallax** — big "CUE" reveals as background layer (~30 min)
- [ ] 💻 **Hover video preloading** — instant play, no jank (~30 min)

### Nice-to-haves

- [ ] 💻 **Micro-animations on stats** — count-up when like/view changes
- [ ] 💻 **Better empty states** — illustrations on `#/saved` empty, filter-no-results
- [ ] 💻 **Focus ring redesign** — brand-colored 2px offset
- [ ] 💻 **Custom `::selection` color** — electric blue highlight

---

## 🚫 Blocked / waiting on decisions

- Which **domain**?
- Which **analytics** — Plausible vs PostHog?
- **Legal review** — lawyer or Termly?
- **CAPTCHA** — Cloudflare Turnstile vs alternative?
- **Awwwards polish** — subtle (Osmo) or bold (Locomotive)?
- **Cursor style** if we build it — dot / ring / blob / custom shape?

---

## 📅 Suggested order of operations

**Week 1 — Foundation**
1. Domain purchase
2. Vercel deploy
3. Clerk prod instance + JWT template
4. Run security lockdown migration
5. Content push #1 (20 new items → total 58)

**Week 2 — Revenue infra**
1. Dodo products created
2. Payment code wired (edge function + entitlement check)
3. Resend setup + welcome email
4. Test full purchase flow on Dodo test mode
5. Content push #2 (finalize 60+ items)

**Week 3 — Polish + launch prep**
1. CAPTCHA on waitlist + feedback
2. View count edge function
3. OG image + analytics
4. Legal review
5. Real iPhone testing
6. Soft launch to 20 friends
7. Bug fixing
8. Product Hunt / Twitter launch prep

**Week 4 — Launch**
1. Public launch
2. Firefight
3. First support tickets
4. First revenue metrics
5. Start P2 backlog based on user behavior

---

## Delivery ownership summary

**Alok (👤 your action) — total ~4-5 hours of your time**
- Buy domain (5 min)
- Vercel + Clerk prod (30 min)
- Clerk JWT template (5 min)
- Run 2 SQL migrations (5 min)
- Resend + Turnstile + Dodo + Sentry signups (60 min combined)
- Content push (10+ hours over multiple sessions)
- OG image design (30 min)
- Legal review coordination (variable)

**Me (💻 code work) — ~15-20 hours of focused sessions**
- Payment wiring
- Email templates
- CAPTCHA integration
- View count edge function
- DPDP cascade delete
- Hardcoded string swaps
- Optional Awwwards polish batches

**Combined:** 3-4 weeks realistic to public launch.

---

## Overall readiness snapshot

| Area | % done |
|---|---|
| Homepage + curation UX | 95% |
| Modal + prompt view | 90% |
| Admin panel + inbox | 95% |
| Feedback + reply threads | 100% |
| Bookmarks + likes + views | 100% |
| SEO / meta / 404 / ErrorBoundary | 100% |
| Legal content (draft) | 95% |
| Sentry error tracking | 100% |
| Security (code side) | 90% |
| Security (RLS) | 10% (migration ready, not run) |
| Pricing page | 90% |
| Payment integration | 0% |
| Email delivery | 0% |
| Analytics | 0% |
| Deployment | 0% |
| Content (38/60 items) | 63% |
| CAPTCHA | 0% |
| Awwwards polish | 0% (optional) |

**Overall: ~65-70% to launch-ready.**
