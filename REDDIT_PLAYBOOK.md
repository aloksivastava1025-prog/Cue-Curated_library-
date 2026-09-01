# Cue — Reddit Launch Playbook

> How to post about Cue on Reddit without getting shadow-removed, banned, or downvoted into oblivion.
> Written for a solo founder from India launching a $99 lifetime component library.

---

## Table of Contents

1. [Why Reddit is hard (and worth it)](#1-why-reddit-is-hard-and-worth-it)
2. [The rules Reddit actually enforces](#2-the-rules-reddit-actually-enforces)
3. [Prep your account before posting](#3-prep-your-account-before-posting)
4. [The 15 target subreddits — audit table](#4-the-15-target-subreddits--audit-table)
5. [Post format anatomy](#5-post-format-anatomy)
6. [Sub-by-sub post templates](#6-sub-by-sub-post-templates)
7. [Launch calendar (2-week schedule)](#7-launch-calendar-2-week-schedule)
8. [Comment engagement playbook](#8-comment-engagement-playbook)
9. [What to do if a post gets removed](#9-what-to-do-if-a-post-gets-removed)
10. [Metrics to track](#10-metrics-to-track)
11. [Anti-patterns — what NOT to do](#11-anti-patterns--what-not-to-do)

---

## 1. Why Reddit is hard (and worth it)

Reddit is the highest-signal traffic source for indie SaaS after Product Hunt. One good r/SideProject post can drive **500–2,000 unique visitors** in 24 hours. But Reddit is also the most hostile to self-promotion of any social platform:

- ~40% of solo-founder launches get removed by mods within 2 hours
- Half of those never see the message because the removal is silent
- Your first two posts in a new sub are the ones most likely to get killed

The single reason: **Reddit optimises for "no ads pretending to be discussion"**. Every post is graded by mods + AutoMod + the community for whether it feels like a genuine share or a marketing plant.

If you win their trust, the signal is real. If you don't, you're invisible.

---

## 2. The rules Reddit actually enforces

### The 90/10 rule (site-wide)

Reddit-wide policy: **no more than 10% of your activity can be self-promotion**. Every promotional post/comment needs ~9 non-promotional ones on the same account.

Mods run `redditmetis` or similar tools that graph your account's self-promo ratio. Cross 15% and you get shadow-banned across many subs (your posts silently don't appear to others).

**Cue's baseline:** if you've been on Reddit for a while but never commented, treat your account as fresh — start commenting helpfully in the target subs for 2–3 days before your first launch post.

### Account age + karma gates

Each subreddit has its own AutoMod thresholds. Common ones:

| Requirement | Typical value |
|---|---|
| Minimum account age | 30–90 days |
| Minimum comment karma | 50–100 |
| Minimum post karma | 10–50 |
| Verified email | Yes |

Below the threshold → post is auto-removed silently, mods can restore if they want.

### Sub-specific rules

Every sub has a rules sidebar. Common Cue-relevant ones:

- **No affiliate / referral links** (r/webdev, r/reactjs)
- **Weekly "Show off your project" thread only** (r/reactjs — check pinned)
- **No pricing pages / paywall links** in main post (r/UXDesign is strict)
- **Flair required** (many mid-size subs)
- **No video-only posts** (r/webdev flags these)

Read the rules for each target sub before posting. Screenshotting them into notes is faster than checking on the fly.

### AutoMod triggers (silent removal)

AutoMod bots run per subreddit. Common triggers that kill Cue-shaped posts silently:

- URL to `cuedesign.space` in the title
- Words like "discount", "off", "coupon", "sale" in the title (spam-adjacent)
- Multiple links in body
- Short post body (< 200 chars) — reads like a hit-and-run
- Same URL posted to 3+ subs in 24 hours (site-wide filter)

**Test:** view your post in an incognito window 5 min after posting. If it doesn't appear on the sub's front page (New sort), it was auto-removed.

---

## 3. Prep your account before posting

**Do this before your first launch post:**

### One-time cleanup
1. **Profile bio** — one honest line ("Solo founder building Cue — Awwwards-tier component library."). No emojis. Include one link at most (cuedesign.space).
2. **Verified email** — check Reddit settings; unverified accounts hit more AutoMod filters.
3. **Recent activity check** — pull up your account, check the last 20 items are a healthy mix. If you've never commented on Reddit before, START THERE (see below).

### 2–3 day warm-up
Before your first Cue post, spend **30–60 min per day** commenting in the target subs. Rules:
- Answer a beginner question (r/reactjs, r/webdev love this)
- Share a technical opinion where you actually have expertise
- Never mention Cue
- Aim for 15–20 helpful comments across the 15 target subs before your first launch post

This gives you:
- Karma buffer that unlocks AutoMod gates
- Comment history that mods check when deciding if your launch post is genuine
- Names / handles you'll see again in comments on your launch post

### Test post
Post one small non-promotional thing first — e.g. "What's your favorite hand-picked resource for component design?" in r/UI_Design or r/reactjs. Watch how many upvotes / comments it gets. If it lands well, your account is warm. If it dies at 0, your account has a shadow issue → post-mortem before launching.

---

## 4. The 15 target subreddits — audit table

Check each sub's rules BEFORE the launch day. Fill this in the week before:

| # | Sub | Members | Self-promo policy | Karma gate | Best day/time (IST) | Notes |
|---|-----|---------|-------------------|------------|---------------------|-------|
| 1 | r/SideProject | 300K+ | Explicitly welcome — founder stories | Low | Weekday morning IST (US evening) | Best first launch |
| 2 | r/reactjs | 500K+ | Weekly Show thread — check pinned | ~50 comment | Tue/Thu 8pm IST | Post outside Show thread → likely removed |
| 3 | r/webdev | 2M+ | No direct promo. Value-first posts only | ~100 | Wed morning IST | AutoMod strict |
| 4 | r/UI_Design | 150K | Design-first, no price mentions | Low | Any weekday IST | Image posts best |
| 5 | r/threejs | 85K | Show off welcomed, no hard sell | Low | Weekend evening IST | GIF/video post |
| 6 | r/cursor | 55K | Tool integrations welcomed | Low | Any weekday | MCP angle strong |
| 7 | r/developersIndia | 500K | Founder stories welcomed | Low | Sat/Sun 8pm IST | India pricing angle |
| 8 | r/interactiondesign | 30K | Motion posts welcomed | Low | Any | Small but hot |
| 9 | r/web_design | 85K | Similar to UI_Design | Low | Any | |
| 10 | r/v0dev | 12K | Community-friendly | Low | Any | Small, high signal |
| 11 | r/Frontend | 500K | Value-first, no promo in title | ~50 | Tue/Thu | |
| 12 | r/indiehackers_in | 5K | Very self-promo friendly | Low | Any | Small, warm |
| 13 | r/creativecoding | 200K | Demo-heavy welcomed | Low | Weekend | WebGL angle |
| 14 | r/tailwindcss | 60K | Tool-adjacent posts fine | Low | Any weekday | |
| 15 | r/nextjs | 100K | Component libraries welcomed | Low | Tue/Thu | |

---

## 5. Post format anatomy

Every Reddit post has 5 elements. Get each right or lose the audience:

### Title (single most important line)

Under 100 chars. NEVER include:
- The word "discount" / "sale" / "off"
- Emojis in the front (spammy)
- ALL CAPS
- URLs
- Ellipses to bait a click

DO include:
- A specific number ("119 hand-picked components")
- A concrete claim ("Awwwards-tier" is specific; "amazing quality" is vague)
- A subtle founder cue ("I built" / "I shipped" / "Solo project")

**Good titles for Cue:**
- `I built 119 hand-picked Awwwards-tier components — 4 months solo`
- `Cue: 119 components curated from Awwwards, with AI prompts + React source`
- `Shipped my curated component library — 43 WebGL / 3D pieces alone`

**Bad titles:**
- `🚀 GET Cue+ FOR $79 LIFETIME — LIMITED TIME` (spammy, banned)
- `Check out cuedesign.space — best components ever!!!` (vague, promotional)

### Body (600–1500 chars, ~4 short paragraphs)

Structure that works:

**Paragraph 1: Personal story (3 sentences)**
> I'm a solo founder from India. Spent 4 months collecting the best UI components I could find across Awwwards, X, Behance, and production apps I admired. Turned each into a copy-paste prompt for Cursor / v0 / Bolt, and hand-shipped React source for the ones that need it.

**Paragraph 2: The problem you solve (2 sentences)**
> Most component libraries feel like variations on the same 20 patterns. Cue is the opposite — every entry is picked because it made me stop and stare, not because it fills a taxonomy row.

**Paragraph 3: Concrete numbers (2 sentences)**
> 119 components live today. 43 of them are WebGL / 3D — the category everyone else undershoots on.

**Paragraph 4: Ask (short)**
> Would love feedback on the library itself, or on the launch itself since I'm doing this solo. Link in comments.

### Link (rules-critical)

**Put the URL in the top comment, not the post body.** Reasons:
- Many subs auto-remove posts with URLs in the body
- A comment link reads as "here for those who asked" — less salesy
- You can edit the comment later to add "Update: sold out at $79, back to $99"

The top comment should be a single line:
> Cue's here — cuedesign.space. Happy to answer anything.

### Image / preview (drives 3× upvotes if used right)

Reddit favors image posts over text posts. For Cue:
- A **grid of 6 component thumbnails** (screenshot the mosaic from the homepage) works best
- A **short GIF** of one signature component (fisheye chromatic, mercury toggle) if the sub allows
- Never link out to a video hosted on cuedesign.space — download the video, upload directly to Reddit

### Flair

Half of mid-size subs REQUIRE flair. Common relevant flairs:
- "Show and tell"
- "Project"
- "Feedback"
- "Launch"

If the sub has a "Self-promotion" flair, use it (marks the post honestly and passes AutoMod).

---

## 6. Sub-by-sub post templates

Below are launch-ready drafts. Personalize the founder story, keep the ask real.

### r/SideProject — FIRST LAUNCH (best-case start)

**Title:** `Shipped Cue after 4 months solo — 119 hand-picked Awwwards-tier components`

**Body:**
```
I'm a solo founder based in India. Spent the last 4 months
curating UI components from Awwwards, X, Behance, and
production apps that made me stop and stare. Each one comes
with a copy-paste prompt for Cursor / v0 / Bolt, plus React
source for the ones that need it.

The bar is taste, not volume — Aceternity has 260, Magic UI
has 150, mine is 119. Every entry is picked because it earned
the slot, not because it filled a category. Biggest strength
is the 43-piece WebGL / 3D bucket — most libraries undershoot
that category by 5×.

Pricing is $99 lifetime for the first 50 founding members
(₹4,999 for India). One-time, no subscription, every future
drop is included.

The pieces where I'd love feedback:
1. Is the taste bar consistent when you scroll through?
2. Does the "prompt + code" split feel right or should code
   be default for every card?
3. What category am I obviously missing?

Link in the top comment.
```

**Top comment:** `cuedesign.space — happy to answer anything about the process, pricing, or specific components.`

### r/reactjs (MUST post in weekly Show thread if it exists)

**Title (if in Show thread):** No title, top-level comment only.
**Title (if separate post allowed):** `Cue — 119 Awwwards-tier React components with AI prompts + source`

**Body:**
```
Built a React component library curated from Awwwards
sites, X interactions, and production apps I admired. 119
components live, each shipping with an AI prompt tuned across
30–80 iterations plus React source for the ones ready to
copy-paste. Works with Framer, Bolt, v0, Cursor.

Tech under the hood:
- Vite + React 18 SPA
- Supabase for prompts + auth via Clerk
- Cloudflare R2 for hover videos (moved after a Supabase
  bandwidth incident wiped 213 GB of egress in 3 days)
- Dodo Payments as MoR (Indian founder, needed auto GST)

Curation angle: 43 WebGL / 3D components (Aceternity has ~10),
plus text animations, scroll transitions, hero sections.
Taste over volume — every entry replaces the previous
"best I could find" for that pattern.

Link in top comment. Curious what devs actually miss most in
current shadcn-style libraries.
```

**Top comment:** `cuedesign.space — happy to nerd out on the stack or the curation.`

### r/webdev — CAREFUL, value-first

**Title:** `I curated 119 Awwwards-tier UI components — here's what I learned about "taste vs volume"`

**Body:**
```
Four-month solo project. Started with the goal of picking 30
components that were *undeniably* better than shadcn's default
set. Ended up at 119 because the bar held — every new addition
had to earn its slot.

Three things I learned:
1. Volume kills libraries. Aceternity has 260, Magic UI has
   150 — you scroll past a lot to find "the good one". Cue's
   119 all pass the same taste bar.
2. Prompts matter more than code. AI is fast enough that
   90% of buyers use prompts, not source. Same iteration
   cost either way.
3. WebGL is underserved. Every "component library" claims
   3D, most ship 4-10 pieces. Cue has 43 — real category,
   not decoration.

Wrote the whole thing solo in India while running email
support out of my inbox. Launched at $99 lifetime for the
first 50 members.

Would love feedback on the library or the curation approach.
Link in top comment.
```

**Top comment:** `cuedesign.space — DM me if you want a walkthrough of the process behind any specific component.`

### r/UI_Design — image-first

**Title:** `Curated 119 UI components from Awwwards — grid of the strongest 12`

**Body (short — the image carries the post):**
```
Solo founder from India. 4 months curating, 119 kept.
Grid attached is the 12 I'd defend hardest.

Each shipped with a prompt for Cursor / v0 / Bolt + React
source for the ones that need it. Full library link in
top comment — feedback on the taste bar welcome.
```

**Image:** Screenshot the mosaic from cuedesign.space showing 12 signature thumbnails.
**Top comment:** `cuedesign.space — happy to talk process behind any of these.`

### r/threejs — GIF-first, technical

**Title:** `18 hand-picked WebGL / three.js components — sharing what I curated`

**Body:**
```
Solo project. Been collecting WebGL demos I actually wanted
to build with — refraction, chromatic aberration, particle
fields, orbital carousels, mercury toggles. 18 in the WebGL
bucket alone, out of 119 total.

Each ships with a source-of-inspiration credit plus a prompt
tuned to reproduce the effect in Cursor / v0 / Bolt. Some
have full three.js source (working on getting that count up).

GIF is `cue059 Fisheye Chromatic Card Grid` — the one I'm
proudest of. Link in top comment for the rest.
```

**GIF:** Upload `cue059` hover video directly to Reddit (max 15 sec).
**Top comment:** `cuedesign.space — DM me if you want the shader tricks behind any specific piece.`

### r/cursor — MCP angle

**Title:** `Built a component library specifically for Cursor prompts — 119 Awwwards-tier pieces`

**Body:**
```
Every component in Cue comes with a prompt tuned specifically
for Cursor's chat / composer. Paste it in, get the intended
result on iteration 1–2 instead of 20.

Cursor-specific tricks I learned:
- Prompts win over verbose specs
- Give AI a reference *and* the desired output style
- Component names matter — Cursor uses them as anchors

MCP server coming next month — you'll be able to say
"Cue, give me a WebGL card carousel" inside Cursor without
copy-paste. For now, prompts + React source.

Link in top comment.
```

**Top comment:** `cuedesign.space — MCP server on npm as @cue/mcp when it ships.`

### r/developersIndia — India-native voice

**Title:** `Bengaluru-based solo founder — shipped 119 Awwwards-tier components (₹4,999 lifetime)`

*(swap city to yours)*

**Body:**
```
Solo, bootstrapped, India-based. Four months of curation
from Awwwards, X, and apps I admired. 119 components with
prompts for Cursor / v0 / Bolt and React source for many.

Priced ₹4,999 lifetime for founding members (₹3,999 with
CUE49, first 20 seats, 24 hours only). GST is included at
checkout via Dodo. USD $99 for international buyers.

Would love feedback from other Indian devs / designers —
does the pricing feel right? Is there a category you'd
want more of?

Link in top comment.
```

**Top comment:** `cuedesign.space — happy to swap notes on running an Indian SaaS solo.`

### r/indiehackers_in

**Title:** `Bootstrapped from India — 4 months to launch, day 3 numbers inside`

**Body:**
```
Full transparency post since this is what I always want to
read as an indie hacker myself.

- 4 months building solo
- Zero paid marketing pre-launch
- ₹4,999 / $99 lifetime, founding-50 model
- Stack: Vite + React, Supabase, Clerk, Dodo Payments (MoR
  handles GST automatically — huge win for Indian founders)
- Cloudflare R2 for media after a 213 GB egress incident
  wiped my free Supabase quota in 3 days

Day 3 metrics I can share:
- X: ~[N] impressions on launch tweet
- Reddit: 0 posts (this is the first)
- Sales: [N] founding memberships, [N] custom-pack requests

Learning I did not expect: pricing psychology is 3× as
important as the product for the first 20 buyers. Landed
on ₹4,999 (with ₹3,999 CUE49 promo) after 3 pricing
iterations in 48 hours (that broke one buyer's trust — Sarang,
sorry man, we sorted it).

Link + full library in top comment. Roast me.
```

**Top comment:** `cuedesign.space — AMA.`

---

## 7. Launch calendar (2-week schedule)

Never post to more than 2 subs on the same day. Never post the same title verbatim to different subs — Reddit's site-wide filter flags cross-posting.

### Week 1 — soft launch

| Day | Sub | Focus |
|---|---|---|
| Mon | (warm-up) | 15+ helpful comments in target subs, no promotion |
| Tue | r/SideProject | Founder story angle |
| Wed | (engagement day) | Reply to every SideProject comment, comment in 5 target subs |
| Thu | r/reactjs (Show thread) | Technical angle |
| Fri | r/UI_Design | Image-first taste angle |
| Sat | r/developersIndia | India-specific, INR pricing |
| Sun | (rest / analytics) | Check r/SideProject 5-day performance |

### Week 2 — hard push

| Day | Sub | Focus |
|---|---|---|
| Mon | r/threejs | WebGL / GIF-first |
| Tue | r/cursor | MCP angle |
| Wed | r/webdev | Value-first, "what I learned" framing |
| Thu | r/interactiondesign | Motion angle |
| Fri | r/Frontend | Technical + curation |
| Sat | r/creativecoding | Generative / WebGL |
| Sun | r/indiehackers_in | Full transparency + numbers |

**If a post gets 500+ upvotes**, pause the calendar for 3 days and just reply / engage — momentum is more valuable than volume at that point.

---

## 8. Comment engagement playbook

Getting upvoted on the post is 30% of the win. Engaging in comments is the other 70%.

### Response rules

- **Reply to every comment in the first 4 hours.** Reddit's algorithm boosts posts with active OP engagement.
- **Reply with substance, not "Thanks!".** Every reply should add something — a detail, a link, a joke, a follow-up question.
- **Don't argue.** If someone criticises the library, ask what they'd want instead. Reddit rewards curiosity, punishes defensiveness.
- **Never delete comments** unless they're spam. Even trolls stay up; you reply once, politely, and move on.

### Common comment types + responses

| Comment type | Response |
|---|---|
| "Cool project, how'd you find these?" | Share 1 specific example ("The mercury toggle was from an Awwwards SotD in July — I built the prompt over 60 iterations before the output matched"). |
| "Isn't shadcn free?" | "Yes, shadcn is free and great — Cue is for the components shadcn doesn't have. Complementary, not competing." |
| "Price too high" | "Fair. Do you have a range you'd pay?" — then thank them. Never justify. |
| "Feature X missing" | "Adding it — you're right." Follow up in a week when it ships. |
| Trolling / gate-keeping | Don't engage. Reddit's algorithm handles them. |

### AMA-style follow-up

If your post gets 200+ upvotes, do an **"OP here, AMA about the process"** comment. Keeps engagement alive for another day.

---

## 9. What to do if a post gets removed

### Silent removal check

5 min after posting, open the sub's "New" tab in an incognito window. If your post isn't there, it was auto-removed.

### Steps

1. **Check the mod-mail / modmail folder** — some subs auto-send a reason.
2. **Read the removed post URL** — Reddit shows a "This post was removed" banner if you're logged in as OP. Sometimes the reason is inline.
3. **Message the mods** — polite, one paragraph, ask what the removal reason was. Mods respond ~30% of the time. Template:

```
Hi mods —

Just posted "<title>" to /r/<sub> and it looks like it was
removed. Read the rules before posting; not sure which one
I tripped. Would appreciate a heads-up so I can rework it
before trying again.

Thanks — <username>
```

4. **Wait 48 hours** before reposting anywhere. Modify title + body substantially — don't just re-submit.
5. **Never message mods twice** in the same week. It reads as pressure.

### If shadow-banned account-wide

Rare but happens. Symptoms: every post silently removed, comments show as 0 karma to others.

- Check https://www.reddit.com/appeal
- Send an appeal explaining you're a solo founder, first-time launcher, will follow rules
- Do NOT create a new account — Reddit fingerprints device + IP; new account gets banned faster

---

## 10. Metrics to track

Set up a simple sheet — 1 row per Reddit post. Track:

| Column | Why |
|---|---|
| Post URL | Reference |
| Sub | Which community |
| Title | For A/B analysis later |
| Timestamp (post) | Correlate with traffic spikes |
| Upvotes after 1h | Early velocity signal |
| Upvotes after 24h | Final reach signal |
| Comments after 24h | Engagement signal |
| Removed? (Y/N) | For sub-specific rule learning |
| Referral traffic (from GA4) | The real signal |
| Sign-ups from Reddit | Convert-rate proof |
| Purchases from Reddit | Bottom-line proof |

Set a **UTM parameter** on the URL you drop in your top comment:
`https://cuedesign.space/?utm_source=reddit&utm_medium=post&utm_campaign=<subname>`

That way GA4 shows which sub actually drove traffic vs upvotes.

---

## 11. Anti-patterns — what NOT to do

Every one of these has killed real indie launches:

1. **Same URL in 5 subs same day** → site-wide filter removes all 5 silently.
2. **"I built X, please share / vote / upvote / follow me"** → shadow-ban trigger.
3. **Replying to every comment with a coupon code** → mods hate this.
4. **Editing the post body 5 minutes after posting** → algorithm drops rank.
5. **Deleting a post that got downvotes and re-posting** → visible in mod tools, kills your account trust.
6. **Cross-posting from your own post** → looks like promotion (it is).
7. **Using an AI-written body** → Reddit's tone-checkers detect this. Write it yourself, then optionally polish.
8. **Ignoring the sub's language** → r/threejs wants technical detail, r/UI_Design wants visual detail, r/SideProject wants founder-story detail. Reusing one body kills relevance.
9. **Bragging about revenue** → Reddit hates "I made $10K in 2 weeks" posts. Share numbers as context, not flex.
10. **Trying to explain the removal** → mods have zero patience for "but my post was fine" DMs.

---

## Ownership

- **Owner:** Alok
- **Update this doc when:** a sub gets a rule change, a template stops working, we find a new sub worth adding.
- **Post-launch retro:** after week 2, come back and add "what actually worked" as section 12.

Last major update: September 1, 2026.
