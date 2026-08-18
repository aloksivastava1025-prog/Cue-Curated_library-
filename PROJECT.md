# CUE — Project Reference

> A curated library of prompts and component references for AI-native builders.
> This document is the single source of truth for anyone new to the codebase.

---

## 1. What CUE is

**CUE** is a premium web library that gives designers and developers battle-tested prompts + component references they can copy-paste into AI tools like **Bolt, v0, Cursor, and Framer** to ship Awwwards-tier interfaces without endless iteration.

### Target user
- Solo designers / freelancers building landing pages fast
- Product designers experimenting with AI tools
- Studios shipping client work with AI-assisted development
- Framer / Webflow builders looking for elevated components

### Positioning vs competitors
| Product | What they do | CUE's edge |
|---|---|---|
| **Osmo** | Free component snippets | We include AI prompts, not just code |
| **21st.dev** | v0-focused UI kit | We're tool-agnostic + editorial curation |
| **Framer Marketplace** | Templates + components | We ship prompts, code comes later |
| **UIverse** | Community components | Curated, not user-submitted |

### Business model
- **Free tier** — preview access, limited items
- **Cue+ Individual** — Available as Annual Subscription or Lifetime Deal, single user
- **Cue+ Team** — Available as Annual Subscription or Lifetime Deal, up to 5 seats
- **Payment** — Dodo Payments (India-based, global support)
- **Content update cadence** — weekly drops (planned)

---

## 2. Tech stack

| Layer | Tool | Why |
|---|---|---|
| **Frontend** | React 18 + Vite 5 | Fast HMR, small bundle, Awwwards-quality possible |
| **Language** | JavaScript (JSX) | No TS ceremony for a solo/small team |
| **Styling** | Inline styles + CSS variables + one CSS file | Avoids CSS-in-JS runtime cost, keeps components portable |
| **Smooth scroll** | Lenis | Momentum + easing, Osmo-tier scroll feel |
| **Auth** | Clerk | Managed auth, magic-link + OAuth, no auth bugs to fix |
| **Database** | Supabase Postgres | Row-level security + edge functions + realtime later |
| **Storage** | Supabase Storage | Media (thumbs + hover videos) on same platform |
| **AI** | Anthropic Claude Sonnet 4.6 | Admin autofill of item metadata via structured outputs |
| **Payments** | Dodo Payments (planned) | Global support, India-friendly, subscription + one-time |
| **Email** | Resend (planned) | Transactional + drop emails, domain verify simple |
| **Error tracking** | Sentry (free tier) | Errors + performance, PII-scrubbed |
| **Analytics** | Plausible / PostHog (planned) | Privacy-first, GDPR-compliant |
| **Deployment** | Vercel (planned) | Free tier + edge network + Git-native |
| **Domain** | TBD (`usecue.com` / similar) | Placeholder in code as `hello@usecue.com` |

---

## 3. Architecture

### Client-side architecture

```
┌─────────────────────────────────────────────────────┐
│                    Browser (React)                  │
│                                                     │
│  ┌───────────┐  ┌────────┐  ┌────────────────────┐  │
│  │  Clerk    │  │ Lenis  │  │ Sentry (PII-safe)  │  │
│  │  session  │  │ scroll │  │                    │  │
│  └───────────┘  └────────┘  └────────────────────┘  │
│                                                     │
│   ┌─────────────────────────────────────────────┐   │
│   │           AppContext (React Context)         │   │
│   │  • allPrompts, drafts (from Supabase)        │   │
│   │  • bookmarkedIds, likedIds (per-user Sets)   │   │
│   │  • filter, selectedItem, toast              │   │
│   │  • toggleBookmark, toggleLike, registerView │   │
│   └─────────────────────────────────────────────┘   │
│                                                     │
│   Pages (hash routing):                             │
│     #/            → Home  (App.jsx)                 │
│     #/admin       → Admin.jsx                       │
│     #/admin/inbox → AdminInbox.jsx                  │
│     #/pricing     → Pricing.jsx                     │
│     #/saved       → Saved.jsx                       │
│     #/legal/:slug → Legal.jsx                       │
│     * unmatched   → NotFound.jsx                    │
└─────────────────────────────────────────────────────┘
                          │
                          ↓ Supabase JS client
                          │  (anon key, later + Clerk JWT)
                          ↓
┌─────────────────────────────────────────────────────┐
│                  Supabase                           │
│                                                     │
│  Postgres tables:                                   │
│    prompts               (library items)             │
│    prompt_contents       (paid prompt text)          │
│    prompt_bookmarks      (user saves)                │
│    prompt_likes          (user likes → trigger)      │
│    feedback              (user submissions)          │
│    feedback_messages     (admin/user threads)        │
│    waitlist_emails       (newsletter signups)        │
│    user_profiles         (Clerk sync + plan info)    │
│                                                     │
│  Storage bucket: cue-media (thumbs + hover videos)  │
│                                                     │
│  Edge functions:                                    │
│    autofill-metadata    (admin AI autofill proxy)    │
│    send-contact         (contact form → email)       │
│    create-checkout      (payment session)            │
│    dodo-webhook         (payment event handler)      │
│    record-view          (deduped view tracking)      │
│                                                     │
│  Row-level security (RLS):                          │
│    Beta permissive → prod locked via Clerk JWT       │
└─────────────────────────────────────────────────────┘
```

### Data flow

**A visitor lands on `#/`:**
1. `main.jsx` initialises Sentry, mounts `<ClerkProvider>`, mounts `<App />`
2. `App.jsx` wraps in `<ErrorBoundary>` + `<AppProvider>`
3. `AppProvider` fetches `backend.list()` → populates `drafts`
4. `MainApp` reads `allPrompts` (seed + drafts), renders `<EditorialCard>` grid
5. Featured items filtered → `<FeaturedRail>`
6. Type-filter (`sections` / `interactions` / `all`) applied in local state
7. Lenis smooth scroll initialised

**Visitor clicks a card:**
1. `setSelectedItem(item)` opens `<Modal>`
2. Modal calls `registerView(item.id)` → edge function `record-view` hashes IP + UA and dedups via DB constraint
3. Modal fetches full prompt content (free) OR shows paywall (premium)
4. User can copy, like, save, share

**Signed-in user bookmarks:**
1. `EditorialCard` heart/bookmark button → `toggleBookmark(item.id)` from AppContext
2. Optimistic UI update (Set toggle) + `backend.addBookmark` server call
3. On sign-out, `bookmarkedIds` cleared
4. `#/saved` page filters `allPrompts` by `bookmarkedIds` Set

**User submits feedback:**
1. `<FeedbackModal>` collects `{ kind, message, email }`
2. Auto-fills email from Clerk if signed in (readonly)
3. `backend.submitFeedback` → `feedback` table INSERT
4. DB trigger: atomic rate-limit `check_and_increment_rate_limit` (3/10min per email or referrer)

**Admin replies:**
1. Admin opens `#/admin/inbox`, sees feedback list
2. Clicks "▸ Reply" on a card, `<FeedbackThread>` expands
3. Types → `backend.postMessage({ author: 'admin' })` → `feedback_messages` INSERT
4. Original user (matched by email) sees notification bell badge next visit

**User replies back:**
1. Bell dropdown in nav shows unread admin replies
2. Click thread → thread expands in dropdown
3. Reply → `backend.postMessage({ author: 'user' })` in same thread

---

## 4. User flows

### 4.1 Visitor (not signed in)
```
Land on #/ 
  ↓
Rotating hero headline + featured rail
  ↓
Browse grid, filter by All/Sections/Interactions
  ↓
Click card → Modal opens
  ↓
[Free item]   → See prompt + code + use case + copy button
[Premium]     → See paywall + "Subscribe" CTA
  ↓
Click "Suggest improvement" (nav menu) → FeedbackModal
  ↓
Submit feedback (email optional)
```

### 4.2 New signup flow
```
Click "Join CUE" in nav
  ↓
Clerk modal opens (email + magic link OR OAuth)
  ↓
Verify email → signed in
  ↓
Return to homepage, now sees:
  • 🔔 bell icon in nav
  • Menu ▾ dropdown with Saved / Suggest / (Admin if admin)
  • Like + bookmark buttons functional on cards
  • Auto-filled email in feedback modal
```

### 4.3 Bookmark + like flow
```
Signed-in user hovers card
  ↓
Bottom-right of card: [❤ count] [👁 count] [🔖]
  ↓
Click ❤ → optimistic count bump, heart fills red, animate scale
Click 🔖 → nav "Saved (N)" badge increments
  ↓
Visit #/saved → see all bookmarked items in grid
  ↓
Un-bookmark from anywhere → syncs across
```

### 4.4 Feedback + reply flow
```
User (signed in) → click "Suggest improvement" → FeedbackModal
  ↓
Email auto-filled (readonly), types message → Send
  ↓
Row in `feedback` table with email attached
  ↓
Admin next opens #/admin/inbox → red badge on nav
  ↓
Admin clicks feedback → "▸ Reply" expand → types reply → Send
  ↓
Row in `feedback_messages` (author='admin')
  ↓
Original user visits any page → 🔔 bell in nav shows count
  ↓
Click bell → dropdown of threads → click thread → sees admin reply
  ↓
User replies from same dropdown → adds to thread
  ↓
Admin sees user reply in the same thread on next inbox visit
```

### 4.5 Admin content flow
```
Sign in as admin (allow-listed email)
  ↓
Nav "Menu ▾" now shows "Admin"
  ↓
#/admin → editor panel with 2 sides:
  • Left: form (title, category, tier, media, prompt, code, use_case)
  • Right: live preview + list of published items
  ↓
Paste prompt in form → click "✨ Auto-fill" → Claude Sonnet 4.6 fills metadata
  ↓
Upload thumb + hover video → Supabase Storage → URL saved
  ↓
Save → INSERT (with id-collision retry) → item appears on public grid instantly
  ↓
Inline toggles on published list: [★] featured, [♥] publish/draft
```

### 4.6 Purchase flow (planned)
```
User on #/pricing → picks Individual or Team AND Annual or Lifetime billing
  ↓
Click "Get Cue+" → sign in if needed
  ↓
Redirect to Dodo checkout (hosted URL) with specific product_id (annual vs lifetime) + user email
  ↓
User pays/subscribes → Dodo webhook fires (`payment.succeeded` or `subscription.active`) → dodo-webhook edge function
  ↓
Function verifies signature + checks idempotency → user_profiles.plan = 'cue_plus', sets `plan_expires_at` based on billing cycle
  ↓
User returns → #/checkout/success → confirmation
  ↓
Next modal open on premium item: paywall gone, prompt visible
```

---

## 5. Database schema

### `prompts` — the library items
| Column | Type | Notes |
|---|---|---|
| id | text PK | e.g. `cue001` (generated via `next_prompt_id()` sequence) |
| title | text | Item name |
| category | text | e.g. "Sliders & Marquees" |
| section | text | Grouping (optional) |
| tier | text | `free` \| `premium` |
| status | text | `published` \| `draft` |
| tags | jsonb (text[]) | e.g. `["scroll", "webgl"]` |
| stack | jsonb (text[]) | e.g. `["Framer", "R3F"]` |
| description | text | Short desc |
| use_case | text | Where to use it |
| component_type | text | `section` \| `interaction` |
| code | text | Sample code (optional) |
| thumb_src | text | Static image URL |
| hover_src | text | Hover video/image URL |
| brand, variant | text | Legacy fields (unused in UI) |
| rail | text \| null | `featured` for hero rail |
| view_count | int | Auto-incremented via RPC |
| like_count | int | Auto-managed by trigger |
| created_at | timestamptz | |

### `prompt_contents` — paid prompt text (kept separate for gating)
| Column | Type |
|---|---|
| prompt_id | text FK → prompts.id |
| content | text |

### `prompt_bookmarks` — user saves
| Column | Type |
|---|---|
| user_id | text (Clerk user_id) |
| prompt_id | text |
| created_at | timestamptz |
| PK (user_id, prompt_id) | |

### `prompt_likes` — user likes (trigger keeps `like_count` in sync)
| Column | Type |
|---|---|
| user_id | text (Clerk) |
| prompt_id | text |
| created_at | timestamptz |
| PK (user_id, prompt_id) | |

### `feedback` — user submissions
| Column | Type |
|---|---|
| id | bigserial PK |
| kind | text (improvement / component_request / other) |
| message | text |
| email | text nullable |
| source | text |
| referrer | text |
| created_at | timestamptz |

### `feedback_messages` — reply threads
| Column | Type |
|---|---|
| id | bigserial PK |
| feedback_id | bigint FK → feedback.id |
| body | text |
| author | text (admin / user) |
| author_email | text nullable |
| created_at | timestamptz |

### `waitlist_emails` — newsletter/waitlist signups
| Column | Type |
|---|---|
| id | bigserial PK |
| email | text unique |
| source | text (e.g. `newsletter-hero`, `pricing-individual`) |
| referrer | text |
| created_at | timestamptz |

### `user_profiles` — Clerk sync + plan info
| Column | Type |
|---|---|
| user_id | text PK (Clerk user_id) |
| email | text |
| full_name | text |
| plan | text (free / cue_plus / cue_plus_team) |
| plan_source | text (dodo / manual / grant) |
| plan_started_at | timestamptz |
| plan_expires_at | timestamptz nullable |
| team_owner_id | text (for team plans) |
| team_seats | int |
| created_at, updated_at | timestamptz |

### v2 Hardening Tables
- **`payment_events`** — idempotency keys (webhook-id) for Dodo webhook
- **`rate_limit_windows`** — row-locked atomic counters for feedback submission
- **`prompt_views`** — composite PK `(prompt_id, viewer_key, viewed_on)` for deduped view tracking
- **`admin_audit_log`** — immutable log of all admin mutations

### `is_cue_admin()` — Postgres helper
Centralises the admin allow-list. Used in all RLS policies:
```sql
select coalesce(
  (auth.jwt() ->> 'email') in (
    'akashkumar7653099@gmail.com',
    'aloksivastava1025@gmail.com'
  ),
  false
);
```

### `is_self(uid text)` — Postgres helper
```sql
select coalesce(uid = (auth.jwt() ->> 'sub'), false);
```

---

## 6. File structure

```
cue_lib/
├── PROJECT.md                      ← you are here
├── REMAINING.md                    ← pending work checklist
│
├── public/
│   ├── favicon.svg
│   ├── robots.txt
│   └── sitemap.xml
│
├── src/
│   ├── App.jsx                     ← main router, homepage
│   ├── main.jsx                    ← entry, Sentry init, ClerkProvider
│   ├── index.css                   ← CSS variables, base styles
│   │
│   ├── components/
│   │   ├── EditorialCard.jsx       ← grid card with hover video, likes, bookmarks
│   │   ├── ErrorBoundary.jsx       ← React error boundary → Sentry
│   │   ├── FeaturedRail.jsx        ← horizontal scroll rail
│   │   ├── FeedbackModal.jsx       ← Suggest improvement modal
│   │   ├── Footer.jsx              ← compact single-row footer
│   │   ├── Modal.jsx               ← item detail (Code / Prompt / UseCase tabs + paywall)
│   │   ├── NavMenu.jsx             ← Menu ▾ dropdown (Saved/Suggest/Admin)
│   │   ├── UserInbox.jsx           ← 🔔 bell + reply threads
│   │   └── WaitlistCTA.jsx         ← inline newsletter form
│   │
│   ├── pages/
│   │   ├── Admin.jsx               ← content editor + AI autofill
│   │   ├── AdminInbox.jsx          ← feedback + waitlist inbox with reply
│   │   ├── Legal.jsx               ← privacy / terms / refund / license
│   │   ├── NotFound.jsx            ← custom 404
│   │   ├── Pricing.jsx             ← 3-tier lifetime pricing
│   │   └── Saved.jsx               ← bookmarks grid
│   │
│   ├── context/
│   │   └── AppContext.jsx          ← app-wide state, bookmarks, likes, views, drafts
│   │
│   ├── hooks/
│   │   ├── useClipboard.js         ← copy-to-clipboard
│   │   └── usePageMeta.js          ← per-route SEO tags
│   │
│   ├── lib/
│   │   ├── backend.js              ← all Supabase RPCs
│   │   ├── supabase.js             ← client with optional Clerk JWT bridge
│   │   └── sentry.js               ← init + PII scrubber
│   │
│   ├── data/
│   │   └── prompts.js              ← seed data (fallback)
│   │
│   └── styles/
│       ├── mobile.css              ← responsive overrides
│       └── overhaul.css            ← editorial design tokens
│
├── supabase/
│   └── functions/
│       ├── autofill-metadata/      ← Claude Sonnet 4.6 metadata proxy
│       ├── send-contact/           ← contact form → email
│       ├── create-checkout/        ← Dodo payment session (planned)
│       ├── create-subscription/    ← Dodo subscription (unused)
│       └── dodo-webhook/           ← payment event handler (planned)
│
├── scripts/
│   ├── import-partner-data.js      ← CSV → Supabase migration script
│   └── restore-cue001.js           ← recovery script
│
└── SQL migrations (root):
    ├── supabase-full-setup.sql
    ├── supabase-migration-admin-inbox.sql
    ├── supabase-migration-component-type.sql
    ├── supabase-migration-feedback.sql
    ├── supabase-migration-feedback-messages.sql
    ├── supabase-migration-feedback-rate-limit.sql
    ├── supabase-migration-inbox-full.sql
    ├── supabase-migration-security-lockdown.sql  ← run before public launch
    ├── supabase-migration-social.sql             ← bookmarks/likes/views
    ├── supabase-migration-user-profiles.sql      ← payment prep
    └── supabase-migration-waitlist.sql
```

---

## 7. Environment variables

### Root `.env` (client-side, shipped in bundle — public values only)
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...     # or pk_live_ for prod
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
VITE_USE_CLERK_SUPABASE_JWT=false          # flip to true before running lockdown migration
```

### `supabase/.env` (server-side, NEVER committed)
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
```

### `.gitignore` ensures both are safe
- `.env` and `supabase/.env` both ignored
- No secrets have ever been committed

### Vite dev proxy
`vite.config.js` includes a dev-only proxy `/api/dev-autofill` that reads `supabase/.env` and forwards to Anthropic. Prod uses the `autofill-metadata` edge function instead.

---

## 8. Development setup

### First-time setup
```bash
# 1. Node 22 required (via fnm)
fnm use 22

# 2. Install deps
npm install

# 3. Create .env from template (get values from Clerk + Supabase + Sentry dashboards)
cp .env.example .env    # if template exists, else create manually

# 4. Run dev server
npm run dev

# 5. Open http://localhost:5173
```

### Running Supabase migrations
1. Open Supabase Dashboard → SQL Editor
2. Paste any `supabase-migration-*.sql` file content
3. Click Run
4. All migrations are idempotent — safe to re-run

### Adding new content
1. Sign in as admin email
2. Go to `#/admin`
3. Paste prompt in the form → click "✨ Auto-fill"
4. Upload thumbnail + hover video
5. Save

### Testing feedback flow
1. Sign in as any user
2. Click "Suggest improvement" from Menu ▾
3. Submit feedback
4. Switch to admin account → `#/admin/inbox`
5. Reply → sign back in as user → see 🔔 badge

---

## 9. Deployment (planned)

### Vercel setup
1. Import GitHub repo (branch: `main` or `Alok_working`)
2. Framework: Vite (auto-detected)
3. Set env vars (same 5 as local `.env`)
4. Deploy
5. Add custom domain

### Clerk production instance
1. Clerk Dashboard → CUE app → "Create production instance"
2. Add production URLs to allow-list
3. Set up JWT template named exactly `supabase` (see security lockdown notes)
4. Swap `VITE_CLERK_PUBLISHABLE_KEY` to `pk_live_...`

### Supabase edge function deploy
```bash
supabase functions deploy autofill-metadata
supabase functions deploy send-contact
supabase functions deploy dodo-webhook
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
```

### Post-deploy security lockdown
1. Set `VITE_USE_CLERK_SUPABASE_JWT=true` on Vercel
2. Run `supabase-migration-security-lockdown.sql` in Supabase SQL Editor
3. Test admin flows work, non-admin flows work
4. Test incognito can't read feedback/waitlist via devtools

---

## 10. Design system

### Colors
```
--bg:         #0A0A0A         (page background)
--card-bg:    #131316         (card fills)
--border:     #232326         (subtle divisions)
--text:       #f2f2f2         (main text)
--text-dim:   #a5a5a5         (secondary)
--text-dimmer:#606062         (tertiary)
--electric:   #0000ff         (primary CTA blue)
--accent:     #ccff00         (highlight lime)
--danger:     #ff4d4d         (errors)
```

### Typography
- **Display serif** — Fraunces (italic 300, used for hero + section titles)
- **UI sans** — Geist (400/500/600, all buttons + body)
- **Legal serif** — Fraunces (section headings in Legal pages)
- **Instrument Serif + Cormorant Garamond** — loaded, standby for future pages

### Motion
- **Lenis** for scroll (duration 0.9, wheelMultiplier 1, disabled on `/admin`)
- **Standard ease** — `cubic-bezier(0.22, 1, 0.36, 1)` (Osmo-style)
- **Reduced-motion** — respected via `prefers-reduced-motion`

### Spacing rhythm
- **Card gap** — 24px column, 48px row
- **Section padding** — 60-100px vertical
- **Modal padding** — 32-40px
- **Nav padding** — 16px 24px

---

## 11. Security posture

Current RLS is **beta permissive** — anyone with the anon key can read/write most tables. This is INTENTIONAL for beta development and is documented in every migration file's header.

**Before public launch:** run [`supabase-migration-security-lockdown.sql`](supabase-migration-security-lockdown.sql) which:
- Writes on `prompts` / `prompt_contents` → admin JWT only
- Reads on `feedback` / `waitlist` / `user_profiles` → admin JWT or self-scoped
- Bookmarks / likes → `user_id = auth.jwt()->>'sub'` enforced
- Storage bucket writes → admin JWT only

**Requires Clerk-Supabase JWT bridge** to be on (see `src/lib/supabase.js`).

Other security measures already in place:
- ✅ Public keys only in client bundle
- ✅ Anthropic key server-side (dev proxy + edge function)
- ✅ Sentry PII scrubber (emails + Clerk IDs redacted)
- ✅ HTML-escaping in `send-contact` (phishing injection blocked)
- ✅ Feedback rate-limit trigger (3 per 10min per email)
- ✅ No `dangerouslySetInnerHTML` anywhere
- ✅ AI autofill schema tightly scoped (only 8 allowed fields)
- ✅ Webhook idempotency and signature verification active
- ✅ View counters deduped via server-side IP hashing
- ✅ Atomic rate-limiting prevents concurrent feedback flooding
- ✅ Immutable admin audit log tracks all content mutations

---

## 12. Known limitations

- **Waitlist has no CAPTCHA** — bots can flood (fix: Cloudflare Turnstile)
- **No Clerk user-delete webhook** — deleting a Clerk user leaves orphan rows in bookmarks/likes/feedback (DPDP right-to-erasure gap)
- **No email delivery** — all "we'll follow up" messages are placeholder until Resend wired
- **No search** — grows in value once library has 100+ items
- **No shareable item URLs** — `#/item/cue001` would enable social sharing
- **Legal content is draft** — comprehensive and accurate but not lawyer-reviewed

---

## 13. Roadmap after launch

- **Payment (Dodo)** — the last big blocker for revenue
- **MCP server** — expose CUE as a Model Context Protocol server for Claude Desktop / Cursor
- **Weekly drops** — automated email newsletter of new items
- **Search** — full-text search across title + tags + description
- **Item URLs** — shareable direct links (`#/item/cue001`)
- **Copy count** — track prompts copied, rank items by usage
- **Related items** — modal footer shows "you might also like"
- **Team seat management UI** — invite / revoke seats
- **Affiliate program** — 30% commission tracking
- **Awwwards polish** — bespoke cursor, split-reveal type, kinetic marquee, route transitions

---

## 14. Contact + ownership

- **Founder:** Alok Srivastava
- **Support email:** `hello@usecue.com` (placeholder until domain final)
- **Admin allow-list:** `akashkumar7653099@gmail.com`, `aloksivastava1025@gmail.com`
- **Repo:** github.com/aloksivastava1025-prog/Cue-Curated_library-
- **Active branch:** `Alok_working`
