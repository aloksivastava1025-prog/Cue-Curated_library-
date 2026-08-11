# CUE — Product Design & UX Strategy

> Senior Product Designer / UX Strategist / Design Systems Lead / SaaS consultant review.
> Written to be useful, not flattering. Where the current direction is weak, it says so.

---

## 0. The one-line verdict (read this first)

**CUE is not a component library. It is a taste-and-recreation product for the AI-building era.** Its only defensible moat is: *curated premium web experiences + an explanation of how each works + a prompt that lets you regenerate/adapt it in your own stack.* The React code is table stakes; the **prompt-to-implementation bridge** and the **curation taste** are the product.

The single biggest strategic risk: CUE is quietly becoming "Aceternity with a serif font." If the goal stays "reach 100 components," it will launch into a crowded graveyard. The goal must change to "own "I saw THAT effect — how do I get it?" for AI-native builders."

---

## 1. What CUE actually is

**Definition:** A curated library of premium, production-grade web *experiences* (sections, interactions, effects, and full page compositions) — each paired with (a) the implementation, (b) a short "how it works" teardown, and (c) an adaptation prompt for AI tools (Cursor, v0, Bolt, Lovable, Claude).

**The problem it solves:** AI can now generate a button. AI cannot reliably give you *taste*, a *proven premium interaction*, or the *judgment* to know what "good" looks like. The painful, still-unsolved job is: *"I saw an award-winning interaction and I want that feeling on my site, fast, without reverse-engineering it."*

**Primary user (pick ONE and build for them):**
- **The AI-native builder / indie hacker / solo founder** shipping a landing page or SaaS marketing site with Cursor/v0/Bolt. They have velocity but not design taste. They will pay for "shipped-in-a-weekend, looks like a $20k site." This is the wedge.

**Secondary users:**
- **Agency/freelance devs** doing client work (highest willingness to pay; care about white-label + speed).
- **Designers** who want to see *how* an interaction is built.

**Explicitly NOT your user (yet):** enterprise React teams (they want shadcn/Radix primitives and a11y guarantees, not "cinematic hero #12").

**Why CUE over the others — be honest about the map:**

| Product | What it is | CUE's angle against it |
|---|---|---|
| **shadcn/ui** | Unstyled primitives you own in your repo | Different job. shadcn = "I need a component." CUE = "I want THAT experience." Don't compete; complement. |
| **Aceternity UI** | Flashy motion React components | Your closest competitor. Differentiate on **complete experiences (sections/pages, not atoms)** + **prompt bridge** + **tighter curation**, not volume. |
| **21st.dev** | Component + prompt registry, MCP-native | They already do "component + prompt." You must beat them on **curation taste** and **full-experience depth**, or you lose. This is the competitor to study hardest. |
| **Magic UI / React Bits** | Free-ish animated components | You are paid + curated + editorial. Free is their moat; taste + completeness is yours. |

**Strongest differentiator (commit to this):**
> **The recreation bridge.** Every CUE item answers "how do I get this in *my* project" three ways — copy the code, read the 3-bullet teardown, or copy a prompt that regenerates it adapted to your stack/brand. Nobody owns the *adaptation* experience well yet.

**Core user journey:**
Land → see a jaw-dropping live experience in the hero → browse the gallery → open one → *play with it live* → copy the prompt OR the code → ship it → come back for the next one → hit a paywall on premium/complete experiences → convert.

---

## 2. Information Architecture

Keep it brutally small at beta. Every extra nav item dilutes the "what is this" answer.

**Navbar (that's it):**
- **Browse** (the gallery — the product)
- **Prompts** (the differentiator, deserves its own surface)
- **Pricing**
- **Search** (icon / ⌘K)
- Auth: **Log in** / **Join** (accent)

**Under a "Browse" mega-flyout (not top-level nav):** category entry points — Heroes, Sections, Interactions, Effects, Navigation, Full Pages.

**On the homepage, not in nav:** Why CUE, How it works, Social proof, FAQ, Collections teaser.

**Do NOT ship at beta:** Docs (a component-level "usage" accordion is enough), Community, Inspiration feed, Creator area, separate Interactions/Effects top-level tabs. These fragment a 100-item catalog and signal "empty product."

**Recommended sitemap:**
```
/                       Home
/browse                 Gallery (filters via query params: ?category=&tag=&sort=)
/c/[slug]               Component / experience detail page
/prompts                Prompt library
/prompts/[slug]         Prompt detail
/collections            Collections index (P1)
/collections/[slug]     A single curated collection
/pricing                Pricing
/search                 Full search results (⌘K overlay everywhere)
/dashboard              User: saved, purchased, recently viewed
/account                Billing, profile
/admin/*                Admin (private)
/login  /signup
/legal/*                Terms, license, privacy
```

---

## 3. Homepage (conversion-first)

Goal: a stranger understands CUE in 5–10 seconds and *feels* the quality, not reads about it.

1. **Hero = a live experience, not a headline.**
   - *Purpose:* prove the product by being the product.
   - *Answers:* "what is this?"
   - *Content:* one real, breathtaking CUE component running live, with a tight headline overlay: **"Award-winning web experiences. Copy the code. Copy the prompt. Ship."** Sub: "Curated premium sections & interactions for people who build with AI." Primary CTA **Browse the library**; secondary **See how it works**.
   - *Interaction:* the hero component is interactive (cursor/scroll reactive). This IS the demo.
   - *Why:* every competitor leads with a headline + component grid. Leading with one flawless *living* experience is the differentiator felt instantly.

2. **The recreation bridge (the "aha").**
   - Show one component with a 3-tab switch: **Live → Code → Prompt.** Let the visitor click through *on the homepage.*
   - *Answers:* "why you and not Aceternity/21st?" — because you get taste + explanation + adaptation.

3. **Gallery preview (12–16 real items).**
   - *Answers:* "is there enough here / is it my taste?"
   - Real cards, hover-to-play, "Browse all →".

4. **Categories strip** (Heroes · Sections · Interactions · Effects · Navigation · Full pages). *Answers:* "will it have what I need?"

5. **Why CUE (3 pillars, not 8 feature cards):** Curated taste · Prompt + code parity · Complete experiences (not atoms).

6. **How it works (3 steps):** Find → Play/Understand → Copy prompt or code → Ship.

7. **Social proof — only if real.** Usage count ("copied 4,213 times"), a few genuine testimonials, logos of tools it works with (Cursor/v0/Bolt/Framer). *If you don't have real proof yet, omit — fake proof kills a premium brand faster than no proof.*

8. **Pricing teaser** (founding lifetime offer) → full pricing.

9. **FAQ** (license, framework, updates, refund).

10. **Final CTA** over a subtle live effect.

Cut anything else. A long homepage on a young product reads as insecurity.

---

## 4. Component discovery

**Layout:** uniform **grid**, not masonry. Masonry looks "gallery/moodboard"; a clean grid reads "product/catalog" and lets the *previews* be the visual interest. (Osmo, your reference, uses a disciplined grid for exactly this reason.)

**Filters that earn their place (MVP):**
- **Category** (Heroes, Sections, Interactions, Effects, Navigation, Full pages) — primary.
- **Type** (Free / Cue+) — drives conversion.
- **Sort** (Newest / Most used / Featured).
- **Search** (⌘K).

**Filters to DELAY or cut:** Difficulty, Technology (GSAP vs Framer vs CSS — most users don't filter by this; put it *on the card* instead), Animation-type taxonomy, Creator (no creators yet). Over-faceting an empty catalog makes it feel emptier. Add facets only when volume demands them.

**Ideal card (Osmo-grade, which we've partly built):**
- Live-on-hover **preview** (paused first-frame at rest — perf + taste).
- **Name** (clean sans, medium).
- **One** primary category (never a tag dump).
- Small badges: **New** / **Cue+** / time — as pills.
- **Tech chip** (GSAP / CSS / Framer) — subtle, bottom corner. This replaces a tech *filter*.
- **Save** (heart) on hover — top right.
- On hover: subtle lift, first-frame → play, quick **Copy prompt** / **Open** affordances.
- **Do not** cram: creator, difficulty, favorite-count, copy-count all onto the card. Pick 4 signals max. Noise kills premium.

---

## 5. Component detail page (this is the actual product — invest here)

The detail page — not the grid — is where value is delivered and where conversion happens. Make it feel like a *product surface*, not a docs page.

**Structure (desktop):**
- **Split layout.** Left/main: a **large live, interactive preview** (this dominates — 60%+ of viewport). Right or top: a sticky action rail.
- **Preview toolbar:** responsive toggle (desktop/tablet/mobile) · theme toggle (dark/light) · "open in full screen" · refresh/replay.
- **Below the fold / in the rail — a segmented control:** **Live · Code · Prompt.** This trio is the soul of CUE.
- **Name + one-line description + tech stack chips.**
- **Primary actions (sticky):** **Copy code** · **Copy prompt** · **Save**. For Cue+ items when logged-out/free: these become **Unlock with Cue+**.
- **"How it works" teardown:** 3–5 bullets — the technique, the library, the trick. *This is your SEO engine and your taste signal. It's what 21st.dev doesn't do well.*
- **Install / dependencies:** exact `npm i ...`, required config (e.g., "needs GSAP + ScrollTrigger"), and where to paste.
- **Responsive preview** inline via the toggle (not a separate section).
- **Related experiences** (same category / same collection) at the bottom.

**Mobile detail page:**
- Preview first, full-bleed, tappable to fullscreen.
- Sticky bottom action bar: **Copy code · Copy prompt · Save.**
- Live/Code/Prompt as a swipeable segmented control.
- Code in a horizontally-scrollable block with a big copy button (never expect mobile users to select text).

**Premium-feel principles:** instant preview (no spinner jank), one-tap copy with satisfying feedback, no doc-site chrome, generous space, motion only on the preview and on copy-confirmation.

---

## 6. Code experience

**MVP (ship this, nothing more):**
- **Copy to clipboard** — the hero action. One button, whole file, toast confirmation ("Copied — paste into your project").
- **Copy prompt** — equal billing.
- **Dependencies shown** as a copyable `npm i` line.
- **Manual usage note** — 1–2 lines ("paste into `components/`, import where needed").

**Explicitly NOT for MVP:** CLI (`npx cue add`), npm package, one-click install, GitHub sync, ZIP download. A CLI is a real engineering + maintenance product; build it only once you have paying users asking for it (P2). 21st.dev's MCP/CLI is nice-to-have, not why people would choose you.

**Ideal copy experience:** button → copies full, ready-to-paste file (imports included) → toast with a subtle check animation → if there are deps, toast has a secondary "Also run: npm i ..." → for Cue+ locked items, the button is replaced by a clean unlock state, never a broken/half-copy.

---

## 7. AI prompt experience (treat the prompt as a product)

This is the differentiator — do not render a gray text blob.

**Where it lives:** *both* — alongside each component (a tab) **and** as a browsable `/prompts` surface. The component-attached prompt regenerates *that* experience; the standalone prompts are reusable "recipes" (e.g., "cinematic dark SaaS hero, adapt to my brand").

**Prompt card / detail should include:**
- The prompt in a **copy-optimized block** with a big Copy button.
- **Target-tool switch:** Cursor · v0 · Bolt · Claude · Lovable — the prompt text adapts (framing/format) per tool. This alone is a reason to use CUE.
- **Fill-in variables** rendered as chips/inputs: `{brand color}`, `{product name}`, `{vibe}` — user fills, prompt updates live, then copies. *This makes the prompt feel like software, not a doc.*
- **What it produces** — a preview/thumbnail of the expected result.
- **Variants** (e.g., "minimal" / "maximal" / "reduced-motion") as a small selector.

**MVP vs later:** MVP = copyable prompt + tool switch + linked to component. Variables/variants = P1. A full prompt *marketplace* = P2/never-unless-demanded.

---

## 8. Admin panel

You are the only creator at beta, so optimize the admin for **speed of publishing**, not for a multi-tenant CMS.

**Admin nav:** Dashboard · Components · Prompts · Collections · Categories/Tags · Media · Users · Sales · Feedback · Settings.

**Per-page essentials:**
- **Components:** table (thumbnail, name, category, type Free/Cue+, status Draft/Published, updated, uses). Filters: status, category, type. Bulk: publish/unpublish, feature, delete. Row actions: edit, duplicate, preview, copy public link.
- **Prompts:** same shape; link to component(s).
- **Collections:** drag-to-order items into a curated set; set cover, title, blurb.
- **Categories/Tags:** merge/rename (critical — your current data has category = tag-dump; you need a clean controlled vocabulary).
- **Users / Sales:** read-mostly at beta — who signed up, what converted, MRR/lifetime revenue. Don't build refunds/subscription management UI; do it in Stripe/Dodo dashboard at beta.
- **Feedback:** a simple inbox of in-app "was this useful?" + requests.

**Component creation workflow (improved — single page, autosave draft, live preview):**
1. **Drop preview media** (video/image) → auto-generate poster/first-frame + responsive variants.
2. **Name + slug** (auto from name).
3. **One-line description** + optional teardown bullets.
4. **Category** (single-select, controlled) + **tags** (multi, controlled).
5. **Tech stack** chips (GSAP/CSS/Framer/…).
6. **Code** (paste; syntax-highlighted; mark entry file).
7. **Dependencies** (auto-suggest from imports; editable).
8. **Prompt(s)** + tool targets + variables.
9. **Type:** Free / Cue+.
10. **SEO:** title, description, OG image (default to preview) — *auto-filled, editable.*
11. **Save draft / Publish** with a **live public-page preview** beside the form the whole time.

*Key improvement over your draft flow:* one screen with autosave + live preview + controlled category/tag vocab, so you can publish an item in <5 minutes and the catalog stays clean. Publishing friction is the enemy of a "build in public" cadence.

---

## 9. Pricing

**Recommended model: Free tier + Cue+ Lifetime (founding) now, add Pro subscription later.**

Rationale: your audience (indie/AI builders, agencies) resists subscriptions for a *utility* they dip into, and a **lifetime founding deal** is the best fit for a "build in public → beta" moment (it funds you, rewards early believers, and creates urgency). Add a subscription only once you have a *recurring* reason (new drops weekly, updates, prompt packs).

**What's free (top of funnel + SEO):**
- Browse everything, live previews.
- **All teardowns** (the "how it works" — this is marketing/SEO, never paywall it).
- **A generous set of free components** + their **prompts** (prompts are cheap to give and are your viral loop).
- Save/favorites.

**What's paid (Cue+):**
- **Complete experiences** (full sections/pages) — the highest-value items.
- **Premium/complex components** production code.
- **Prompt variables/variants + all tool targets.**
- Future: updates, new-drop access, white-label/commercial license tier for agencies.

**Do NOT monetize:** search, saving, basic components, the teardown explanations, or the previews. Those are the funnel; paywalling them starves it.

**Pricing page structure:** Free vs Cue+ two-card comparison (not a 4-tier wall) → short feature comparison table → founding-lifetime price with a real scarcity element (first N members / launch window) → FAQ (license, refund 14–30 day, framework support, updates) → CTA. Add an **Agency/commercial** license line item (higher price, white-label rights) — this is where real revenue hides.

**Upgrade flow:** contextual — the unlock prompt appears *on the premium item the user already wants*, pre-selected, one screen to pay, then instantly returns to the unlocked item. Never route a hot lead to a generic pricing page and lose them.

---

## 10. User dashboard

**MVP only:**
- **Saved / Favorites** (the reason to have an account at all).
- **Recently viewed.**
- **Purchased / Unlocked** (if Cue+).
- **Billing** (link out to Stripe/Dodo portal).
- **Profile** (minimal).

**Not MVP:** collections-by-user, downloads history, API/CLI keys, team. Add when the feature they belong to ships.

*Design principle:* the account exists to **save and to unlock** — nothing else at beta. Don't build a "dashboard" that's mostly empty; make it a tidy "your library."

---

## 11. Search

**MVP:** ⌘K overlay everywhere. Instant client-or-lightweight-index search over **name + category + tags + tech**, with **visual result rows (thumbnail + name + category)**, typo tolerance (basic fuzzy), and recent/suggested queries when empty. Searches like "hero", "cursor", "bento", "404", "GSAP", "3D" must all hit — which requires a **clean, controlled tag vocabulary** (again: fix the data).

**Later (P1/P2):** semantic/AI search ("something moody and editorial for a fashion brand"), "related results," image-similarity. Genuinely valuable and on-brand for an AI product — but only after the catalog and tags are clean, or it returns garbage.

---

## 12. Collections

**Yes — valuable, and cheap to do well.** Collections turn a flat catalog into *outcomes*, which is how your ICP thinks ("I'm building an agency site," not "I need interaction #7").

**At beta:** *editorially curated by you only* — "Dark SaaS landing," "Creative studio," "Portfolio," "Awwwards-style interactions," "Ship a landing page this weekend." These double as SEO landing pages and as bundles you can sell.

**User-created/shareable collections:** P1/P2. Nice, not essential; adds account complexity. Ship editorial collections first; they carry 90% of the value with 10% of the build.

---

## 13. Social proof & community

**Show only metrics that are real and decision-relevant:**
- **Usage/copy count** per item ("copied 3,120 times") — strong proof of usefulness.
- **Save count** (if genuine).
- A **small** number of real testimonials.
- **Tool-compatibility logos** (works with Cursor/v0/Bolt/Framer).

**Avoid vanity metrics:** fake "10,000 developers," view counts, star inflation. On a premium brand, hollow numbers *reduce* trust.

**Community at beta:** don't build it. A single "Request a component / vote" board (even a lightweight external tool) captures demand signal without a forum to moderate. Real community is a P2 that needs a population you don't have yet.

---

## 14. Creator marketplace

**Not at launch. This is a P2 and possibly a distraction.** Two-sided marketplaces are 10× harder than they look: you need supply quality control, payouts, revenue-share, review pipelines, and a demand base first. It also **directly threatens your core moat** (curation taste) — the moment anyone can submit, average quality drops and "curated" becomes a lie.

**When/if you do it (future):** invite-only, heavy editorial review, revenue share (~70/30 creator-favored), creator profile + analytics, and a strict "does this meet the CUE bar?" gate. Frame it as "featured guest creators," not an open bazaar. Until then, *you* are the curator, and that's the brand.

---

## 15. Mobile UX (designed, not shrunk)

Reality check: developers **copy code on desktop.** Mobile's job is **discovery, inspiration, and saving** — the "browse on the couch, copy at the desk" pattern. Design for that.

- **Nav:** collapse to a bottom bar or a single hamburger + persistent ⌘K/search icon + Join.
- **Browsing:** single-column, big beautiful previews (mobile is where previews shine); hover→tap-to-play.
- **Preview:** full-bleed, tap for fullscreen, pinch to zoom.
- **Code:** show it, make **Copy** a huge sticky button; horizontal scroll, never manual select.
- **Prompt:** on mobile the **prompt is the hero action** (copy → paste into a mobile AI app is realistic; copying a full React file to code on a phone is not). Elevate "Copy prompt" above "Copy code" on mobile.
- **Filters/search:** full-screen drawer, not cramped dropdowns.
- **Pricing/account:** simple stacked cards; checkout via hosted (Stripe/Dodo) mobile flow.

---

## 16. Design system (the shell should be quiet so the components are loud)

**North star:** CUE the *product* should feel **technical-editorial and calm** — a premium frame around loud content. Right now the shell leans serif-italic-everything, which competes with the components. Restrain it.

- **Typography:** a precise **grotesk sans** for all UI/product chrome (Geist, Inter, or similar). Reserve a **serif** (Fraunces) for *editorial accents only* — the "Collection" hero, collection titles, section intros — never for card titles or UI. One serif moment per screen, max.
- **Scale:** modular ~1.2–1.25. Display (hero) / H1 / H2 / body / small / mono. Mono (JetBrains Mono/Geist Mono) for code + tech chips.
- **Color:** near-black base (#0A0A0B), layered dark surfaces (#141416, #1C1C1F), hairline borders (rgba white 6–10%). **Soften the accent** — pure `#0000FF` electric blue is harsh; move to a refined electric (#3B5BFF-ish) or a signature that isn't the default-hyperlink blue. One accent, used sparingly. Support **light mode** for previews (buyers test both).
- **Radius:** 8px media, 12–14px cards, 999px pills. Consistent.
- **Shadows:** almost none in dark UI; use borders + elevation-by-surface-color. Reserve soft shadow for modals/menus only.
- **Cards/buttons:** as built now (Osmo-grade) — inset media frame, pill badges, one primary + one ghost button.
- **Spacing:** 4px base; 8/12/16/24/48 rhythm. Generous row gaps in the grid.
- **Icons:** one set, thin, geometric (Lucide/Phosphor-thin). No mixed icon styles.
- **Motion:** see §17.

---

## 17. Interaction design (CUE's own motion language)

Rule: **the components are the fireworks; the app is the gallery lighting.** The product chrome should be almost still, so the previews pop.

- **Where motion belongs:** the live previews (obviously), copy-confirmation (a crisp check + toast), hover-to-play on cards (subtle lift + first-frame→play), page/route transitions (a quick, tasteful fade/slide — you added Lenis, keep it buttery), ⌘K open/close.
- **Where motion must NOT be:** filtering (instant), search results (instant), nav, buttons beyond a 120–160ms state change, text on scroll (no letter-by-letter reveals in the *product* — that's a component you sell, not your chrome).
- **Principles:** fast in / gentle out (~cubic-bezier(0.22,1,0.36,1)), 120–400ms, respect `prefers-reduced-motion` everywhere (you've started this — enforce it), never animate layout on scroll (perf), GPU transforms only.
- **Copy feedback** is the most important micro-interaction in the whole product — make it feel *great*.

---

## 18. Conversion funnel & friction

| Stage | Friction | Fix |
|---|---|---|
| Discovers CUE | "What is this?" unclear | Live hero component + one-line value prop (§3). |
| Sees a component | Card noise / unclear it's interactive | 4-signal cards, hover-to-play, clear "Open". |
| Interacts | Slow/janky preview | Instant preview, first-frame posters, perf budget 60fps (in progress). |
| Understands value | Prompt/code buried | Live·Code·Prompt trio front-and-center on detail + homepage. |
| Explores | Empty-feeling catalog | Grid + collections + "most used"; avoid over-faceting. |
| Signs up | Forced account too early | **No login to browse or copy free items.** Auth only to save or unlock. |
| Saves/copies | Copy fails / half-file | One-click full-file copy + satisfying toast. |
| Returns | No reason to | New drops, "build in public" cadence, save library, email on new items in saved categories. |
| Upgrades | Generic pricing wall | **Contextual unlock on the exact item they want**, one-screen checkout, return to unlocked item. |

**Biggest friction to kill first:** gating browse/copy behind login, and any preview jank. Both silently kill the top of funnel.

---

## 19. MVP vs future

### MUST HAVE BEFORE BETA (P0)
- Clean **homepage** with a live hero component + Live/Code/Prompt "aha".
- **Browse grid** (category + Free/Cue+ + sort + ⌘K search).
- **Detail page** with large live preview + **Live·Code·Prompt** + copy code + copy prompt + deps + teardown.
- **Copy** (code + prompt) done beautifully.
- **Auth only for save + unlock** (browsing is open).
- **Cue+ paywall** on premium/complete items + **contextual checkout** (Stripe/Dodo hosted).
- **Admin**: fast single-page component/prompt publish with **controlled categories/tags** and live preview.
- **Clean data/taxonomy** (fix the tag-dump; one primary category + controlled tags).
- **Perf**: 60fps scroll, first-frame posters, reduced-motion.
- **Mobile**: browse + preview + copy-prompt-first + save.
- **Legal**: license terms (personal vs commercial/agency), refund policy.

### SHOULD HAVE AFTER BETA (P1)
- Editorial **Collections** (as SEO + bundles).
- **Prompt variables + tool-target switch + variants.**
- **User dashboard** polish (recently viewed, purchased).
- **Most-used / trending** signals (real).
- **Light mode** for previews; responsive toggle in preview.
- **Semantic search** (once taxonomy is clean).
- **Agency/commercial license** tier + upgrade flow.

### FUTURE / SCALE (P2)
- CLI / npm / one-click install / MCP.
- **Creator marketplace** (invite-only, heavy curation).
- User-created & shareable collections.
- Community / requests board → forum.
- Team plans, seats, SSO.
- API.

---

## 20. Final blueprint & priorities

**Sitemap / Nav / Homepage / Discovery / Detail / Code / Prompt / Dashboard / Admin / Pricing / Search / Collections / Community / Marketplace / Design system / Mobile** — all specified in §§2–17.

### Prioritized backlog

**P0 (necessary for a credible beta):**
1. Homepage with live hero + Live/Code/Prompt aha.
2. Browse grid + minimal filters + ⌘K.
3. Detail page: big live preview + Live·Code·Prompt + copy + deps + teardown.
4. Copy experience (code + prompt) — flawless.
5. Open browsing; auth only for save/unlock.
6. Cue+ paywall + contextual hosted checkout.
7. Admin fast-publish + controlled taxonomy + live preview.
8. Data cleanup (categories/tags).
9. Perf (60fps, posters, reduced-motion).
10. Mobile essentials + license/refund pages.

**P1 (right after):** editorial collections; prompt variables/tool-targets/variants; dashboard polish; real "most used"; light-mode + responsive preview; semantic search; agency license + upgrade flow.

**P2 (later/scale):** CLI/npm/MCP; creator marketplace; user collections; community; teams/SSO; API.

---

## The 5 biggest changes I'd make (critical, founder-proof)

**1. Kill the "100 components" goal. Replace it with "20 flawless complete experiences + prompts."**
Component *count* is a vanity metric and a trap — it puts you in a volume race against free libraries you can't win. Your moat is *taste + completeness + adaptation*. Twenty jaw-dropping full sections/pages, each with a great prompt and teardown, beats 100 good atoms. Volume is the competitors' game; curation is yours. Every hour spent racing to 100 is an hour not spent making the product defensible.

**2. Make the prompt bridge the hero of the product, not a tab.**
"Copy the code" is commoditized (Aceternity, Magic UI, everyone). "Copy a prompt that regenerates this adapted to *my* stack/brand, targeted at *my* AI tool, with fill-in variables" is a genuine wedge for the AI-native builder — and it's the one thing that stays valuable *as* AI gets better. Put Live·Code·Prompt at the center of the detail page **and the homepage**. If you build one thing exceptionally, build this.

**3. Pick ONE user — the AI-native builder — and cut everything that isn't for them.**
Right now the product hints at five audiences (indie devs, agencies, designers, AI builders, Framer/Webflow). That's the same as none. Commit to the AI builder shipping a landing page fast. It reorders your whole roadmap: prompt bridge > CLI, complete experiences > atoms, "ship a landing page this weekend" collections > a taxonomy of animation types. Agencies become the monetization upside (commercial license), not the design target.

**4. Stop the product chrome from competing with the components.**
The serif-italic-everything, harsh electric-blue, flashy-shell direction makes CUE look like *one of its own components* instead of a premium *product*. The best galleries are quiet so the art is loud (that's exactly why Osmo reads premium). Move to a calm technical-editorial system: grotesk sans for UI, serif for one editorial accent per screen, a refined accent color, near-still chrome, fireworks only in the previews. This is a taste signal buyers read instantly.

**5. Radically shrink the MVP — open browsing, one paywall, no marketplace/CLI/community.**
The prompt lists ~15 systems; a small team shipping all of them ships none well. The entire beta is: *browse (no login) → play → copy code/prompt → hit a Cue+ wall on premium items → contextual checkout → save.* No CLI, no creator marketplace, no community, no teams, no semantic search at beta. Every one of those is a product unto itself and a way to launch late with a diluted core. Ship the sharp core, get real usage/conversion data, then let *demand* — not feature FOMO — decide P1/P2.

**Bonus honest callout:** CUE's real risk isn't design — it's that it's a *content business* wearing a SaaS costume. Its survival depends on **curation velocity + brand + the prompt bridge**, not code or features. Protect those three; treat everything else as optional.
