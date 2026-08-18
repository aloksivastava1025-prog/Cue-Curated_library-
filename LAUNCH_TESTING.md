# CUE — Pre-Launch Testing Checklist

> Every box below has to be **actually tested** on **staging** before flipping
> to prod. Not "the code exists" — "I ran it, it worked, the failure case
> also behaved correctly."
>
> Testing order: pick a section, run every test in it, log pass/fail in the
> right column. If anything fails, fix and re-run *that whole section*.

---

## 🔐 A. Auth flows (Clerk)

| # | Test | Expected | ✅ |
|---|---|---|---|
| A1 | Sign up with new email (magic link / OAuth) | Session set, redirected back, nav shows user avatar | ☐ |
| A2 | Sign in with existing email | Session set, home renders | ☐ |
| A3 | Sign out | Redirect to home, nav shows "Join CUE" button | ☐ |
| A4 | Sign in on Saved page | Returns to `#/saved` after auth, not home | ☐ |
| A5 | Admin email sign-in | "Admin" appears in nav dropdown | ☐ |
| A6 | Non-admin email sign-in | No "Admin" link visible | ☐ |
| A7 | Admin URL access as non-admin | `#/admin` falls through to home / not-found | ☐ |
| A8 | Email verification required | Unverified user can't purchase (once payment live) | ☐ |

---

## 🏠 B. Core browsing UX

| # | Test | Expected | ✅ |
|---|---|---|---|
| B1 | Homepage loads with all 38 items | Grid renders, no empty state | ☐ |
| B2 | Featured rail shows only featured items | Correct items in rail (newest first) | ☐ |
| B3 | Type toggle — All / Sections / Interactions | Filters correctly, counts match | ☐ |
| B4 | Tier dropdown — All / Free / Paid | Filters correctly | ☐ |
| B5 | Tag multi-select | Multiple tags = OR (union) match | ☐ |
| B6 | Tag normalization | "Framer" & "framer" show as one option | ☐ |
| B7 | Tag search inside dropdown | Filters as you type | ☐ |
| B8 | Selected tag chips above grid | Visible, ✕ removes correctly | ☐ |
| B9 | "Clear all" resets everything | Type / tier / tags all reset | ☐ |
| B10 | Grid sorted newest-first | cue039 (newest) appears before cue001 | ☐ |
| B11 | "New" badge on items < 7 days | Only fresh items show it, not all | ☐ |
| B12 | Empty state — no matching filter | "Clear filters" button appears | ☐ |
| B13 | Card hover video plays | Only on hover, pauses off | ☐ |
| B14 | Card image lazy-loading | Cards off-screen don't fetch images | ☐ |

---

## 💬 C. Detail modal

| # | Test | Expected | ✅ |
|---|---|---|---|
| C1 | Click card → modal opens | Header, tabs, actions visible | ☐ |
| C2 | Escape key closes modal | Modal closes, body scroll returns | ☐ |
| C3 | Click backdrop closes modal | Same | ☐ |
| C4 | Copy prompt button | Clipboard has full prompt text | ☐ |
| C5 | Copy code button | Clipboard has code | ☐ |
| C6 | View count increments on open | +1 on first open, no increment on refresh within 12h | ☐ |
| C7 | View count 12h dedup | Open, close, reopen within 12h → still same count | ☐ |
| C8 | Premium item shows paywall | Free tier user sees "Subscribe" state | ☐ |
| C9 | Modal on mobile — full-width | No horizontal overflow, close btn reachable | ☐ |

---

## ⭐ D. Bookmarks / likes / views (signed-in only)

| # | Test | Expected | ✅ |
|---|---|---|---|
| D1 | Sign in → bookmark card | Icon fills blue, nav "Saved (1)" appears | ☐ |
| D2 | Un-bookmark same card | Icon un-fills, nav count decrements | ☐ |
| D3 | Signed-out bookmark click | Clerk sign-in modal opens | ☐ |
| D4 | Like card → heart animates | Red fill + scale bounce, count +1 | ☐ |
| D5 | Un-like | Count -1, heart un-fills | ☐ |
| D6 | Rapid double-click like | Ends in consistent state (not stuck between) | ☐ |
| D7 | `#/saved` page shows only bookmarked | Grid filters correctly | ☐ |
| D8 | Sign out → sign in as different user | Different bookmarks/likes visible, not previous user's | ☐ |
| D9 | Like count visible publicly | Signed-out user sees the number, just can't click | ☐ |

---

## 📨 E. Feedback + admin threading

| # | Test | Expected | ✅ |
|---|---|---|---|
| E1 | Signed-out user submits feedback (no email) | Success, admin sees "no email attached" | ☐ |
| E2 | Signed-in user submits feedback | Email auto-fills, readonly | ☐ |
| E3 | Feedback rate limit (3 in 10 min) | 4th submission from same email → blocked | ☐ |
| E4 | Admin `#/admin/inbox` shows new feedback | Latest at top, "NEW" badge visible | ☐ |
| E5 | Admin clicks "▸ Reply" on feedback | Textarea + send button appear | ☐ |
| E6 | Admin replies to feedback with email | Reply saves, thread shows both messages | ☐ |
| E7 | Original user visits any page | Nav bell shows red badge with count | ☐ |
| E8 | User clicks bell → sees threads | Dropdown lists their feedback threads | ☐ |
| E9 | User replies in thread | Reply lands, admin sees it in inbox | ☐ |
| E10 | Per-thread reply drafts | Type in thread A, switch to B → A's draft preserved | ☐ |
| E11 | Bell unread snapshot | Highlights visible after opening panel (don't disappear instantly) | ☐ |

---

## 🎛️ F. Admin panel

| # | Test | Expected | ✅ |
|---|---|---|---|
| F1 | Add new item — form validation | Empty title blocks save | ☐ |
| F2 | AI autofill button | Paste prompt → Claude fills title/tags/description | ☐ |
| F3 | Upload thumbnail (< 5MB) | Success, URL saved, preview shows | ☐ |
| F4 | Upload hover video (< 20MB) | Success, plays on hover on card | ☐ |
| F5 | Upload oversized file | Friendly error, no partial save | ☐ |
| F6 | Save new item → appears on grid instantly | Real-time visible | ☐ |
| F7 | Edit existing item | Changes reflect on grid after save | ☐ |
| F8 | Star toggle (feature) | Item appears/disappears from featured rail | ☐ |
| F9 | Publish/draft toggle | Draft items hidden from public grid | ☐ |
| F10 | ID collision guard | Two admins saving same time don't overwrite | ☐ |
| F11 | Admin inbox nav badge | Correct unread count | ☐ |
| F12 | CSV export | Downloads valid CSV for feedback + waitlist | ☐ |

---

## 📜 G. Legal + navigation

| # | Test | Expected | ✅ |
|---|---|---|---|
| G1 | Footer "Suggest" from home | Opens FeedbackModal | ☐ |
| G2 | Footer "Suggest" from `#/saved` | Opens FeedbackModal (was broken pre-fix) | ☐ |
| G3 | Footer "Suggest" from `#/pricing` | Opens FeedbackModal | ☐ |
| G4 | Legal pages load | All 4 (privacy/terms/refund/license) render | ☐ |
| G5 | Legal cross-nav links | Tab switching works | ☐ |
| G6 | Legal TOC anchor links | Click jumps to section with scroll-margin | ☐ |
| G7 | 404 route | Custom in-brand page (not white screen) | ☐ |
| G8 | Sitemap.xml accessible | Returns 200 with URLs | ☐ |
| G9 | robots.txt accessible | Returns 200 | ☐ |

---

## 💳 H. Payment flow (after Dodo integration)

| # | Test | Expected | ✅ |
|---|---|---|---|
| H1 | Click "Get Cue+ Individual" | Redirects to Dodo test checkout | ☐ |
| H2 | Test card `4242 4242 4242 4242` | Payment succeeds | ☐ |
| H3 | After payment → redirect back | Shows success confirmation | ☐ |
| H4 | user_profiles.plan = 'cue_plus' | DB row updated | ☐ |
| H5 | Signed in → open premium item | Paywall gone, prompt visible | ☐ |
| H6 | Sign out → open premium item | Paywall back | ☐ |
| H7 | Duplicate webhook (same webhook-id) | Second call returns duplicate: true, no double email | ☐ |
| H8 | Invalid webhook signature | 401 response, nothing written to payment_events | ☐ |
| H9 | Stale webhook timestamp (>5min old) | 401 response | ☐ |
| H10 | Team plan (5 seats) purchase | 5 slots allocated, invite flow works | ☐ |
| H11 | Refund via Dodo dashboard | Webhook fires, plan reverts to 'free' | ☐ |
| H12 | Failed card | Friendly error, no plan set | ☐ |

---

## 🛡️ I. Security (RLS after lockdown migration)

| # | Test | Expected | ✅ |
|---|---|---|---|
| I1 | Incognito → devtools → `supabase.from('feedback').select()` | Empty array or permission denied | ☐ |
| I2 | Incognito → devtools → `waitlist_emails` select | Empty / denied | ☐ |
| I3 | Signed in as user A → try user B's bookmark ID | Cannot read | ☐ |
| I4 | Signed in as user A → INSERT with user B's user_id | Blocked by RLS | ☐ |
| I5 | Anon → INSERT into `prompts` | Blocked | ☐ |
| I6 | Anon → INSERT into `feedback_messages` with author='admin' | Blocked | ☐ |
| I7 | Signed-in user submits feedback_message with author='user' | Allowed | ☐ |
| I8 | Admin JWT → all reads work | Full inbox visible | ☐ |
| I9 | User reads OWN feedback thread | Success (via email match) | ☐ |
| I10 | Storage upload as anon | Blocked | ☐ |
| I11 | Storage read (public bucket) | Works for everyone | ☐ |

---

## ⚡ J. Rate limits + anti-abuse

| # | Test | Expected | ✅ |
|---|---|---|---|
| J1 | Feedback burst (10 in 1s from same email) | 3 succeed, 7 return 429 | ☐ |
| J2 | Waitlist duplicate email | Idempotent success, no dup row | ☐ |
| J3 | View counter spam (100 hits on same item) | Deduped per viewer/day, count only bumps once | ☐ |
| J4 | Autofill spam (admin) | Per-minute cap hits at N calls, returns 429 | ☐ |
| J5 | Turnstile invalid token | Blocked (once integrated) | ☐ |
| J6 | Turnstile replay same token | Blocked (once integrated) | ☐ |

---

## 📱 K. Mobile responsive (real iPhone Safari)

| # | Test | Expected | ✅ |
|---|---|---|---|
| K1 | Homepage on iPhone | No horizontal scroll, nav wraps cleanly | ☐ |
| K2 | Modal on iPhone | Fits viewport, close btn reachable | ☐ |
| K3 | Filter bar on mobile | Stacks vertically, all three visible | ☐ |
| K4 | Admin panel on tablet | Form + list side-by-side or stack | ☐ |
| K5 | Feedback modal on mobile | Textarea usable, keyboard doesn't cover Send | ☐ |
| K6 | User inbox bell on mobile | Dropdown doesn't overflow screen | ☐ |
| K7 | Hover video on touch device | Falls back to still image, no jank | ☐ |
| K8 | Bookmark/like touch targets ≥ 44px | Not fiddly on thumbs | ☐ |
| K9 | Pricing page on mobile | Cards stack, prices readable | ☐ |
| K10 | Text sizes on mobile | Hero + body legible without zoom | ☐ |

---

## 🚀 L. Performance

| # | Test | Expected | ✅ |
|---|---|---|---|
| L1 | Lighthouse Performance ≥ 85 | Run once on prod URL | ☐ |
| L2 | Lighthouse Accessibility ≥ 90 | Same | ☐ |
| L3 | Lighthouse Best Practices ≥ 95 | Same | ☐ |
| L4 | Lighthouse SEO ≥ 95 | Same | ☐ |
| L5 | First Contentful Paint < 1.5s | On 4G throttled | ☐ |
| L6 | Time to Interactive < 3s | On 4G throttled | ☐ |
| L7 | Total bundle size < 300KB gzip | `npm run build` output | ☐ |
| L8 | Images all lazy-loaded | Verify with Network tab | ☐ |
| L9 | Hover videos don't autoplay off-screen | Bandwidth check | ☐ |
| L10 | Load test — 50 concurrent users | No 5xx, latency < 500ms | ☐ |

---

## 🌐 M. Cross-browser

| # | Test | Expected | ✅ |
|---|---|---|---|
| M1 | Chrome (latest) | Everything works | ☐ |
| M2 | Firefox (latest) | Everything works | ☐ |
| M3 | Safari (latest) | Everything works, no polyfill missing | ☐ |
| M4 | Edge (latest) | Everything works | ☐ |
| M5 | Chrome Android | Mobile flows work | ☐ |
| M6 | Safari iOS | Mobile flows work (real iPhone) | ☐ |
| M7 | Dark mode default | No white flashes | ☐ |
| M8 | Reduced motion respect | Animations subdued when OS setting on | ☐ |

---

## 🚨 N. Error handling

| # | Test | Expected | ✅ |
|---|---|---|---|
| N1 | Trigger JS error in devtools | ErrorBoundary shows in-brand page | ☐ |
| N2 | Sentry receives the error | Event appears in dashboard | ☐ |
| N3 | Sentry PII scrubber | Emails redacted in event payload | ☐ |
| N4 | Supabase offline scenario | Friendly loading/error state, no crash | ☐ |
| N5 | Clerk timeout on sign-in | Graceful message | ☐ |
| N6 | Unknown route | 404 page renders | ☐ |
| N7 | Big prompt copy (100KB text) | Doesn't freeze UI | ☐ |
| N8 | Slow network (throttled) | Loading skeleton appears, then content | ☐ |

---

## 🔬 O. Edge functions (deployed to Supabase)

| # | Test | Expected | ✅ |
|---|---|---|---|
| O1 | `autofill-metadata` — valid prompt | Returns proper JSON with all fields | ☐ |
| O2 | `autofill-metadata` — 200KB prompt | Handles, no timeout | ☐ |
| O3 | `autofill-metadata` — no admin JWT | 401 | ☐ |
| O4 | `send-contact` — HTML escaping | `<script>` in message renders escaped | ☐ |
| O5 | `dodo-webhook` — full flow tested (§H) | See payment section | ☐ |
| O6 | `record-view` — deduped by (prompt_id, viewer_key, date) | Second call same key = no-op | ☐ |
| O7 | Edge function logs visible in Supabase dashboard | Structured JSON | ☐ |
| O8 | CORS allow-list works | Prod domain OK, others blocked | ☐ |

---

## 💾 P. Backup + rollback

| # | Test | Expected | ✅ |
|---|---|---|---|
| P1 | Latest CSV backup exists | Alok's Google Drive has it | ☐ |
| P2 | Supabase PITR available | Point-in-time restore option in dashboard | ☐ |
| P3 | Migration rollback script tested | Staging RLS rolled back successfully | ☐ |
| P4 | JWT flag kill-switch works | `VITE_USE_CLERK_SUPABASE_JWT=false` restores anon access | ☐ |
| P5 | Table restore from CSV works | Delete a row, restore from backup CSV | ☐ |

---

## 🎬 Q. Final canary (48h prod watch)

| # | Test | Expected | ✅ |
|---|---|---|---|
| Q1 | Soft-launch link to 5-7 friends | Everyone can access | ☐ |
| Q2 | No Sentry errors in 48h (excluding known warnings) | Clean | ☐ |
| Q3 | Sample feedback flow tested by real user | Works end-to-end | ☐ |
| Q4 | Sample bookmark flow tested by real user | Works | ☐ |
| Q5 | Sample purchase tested by 1 friend (real $$) | Full flow works, plan updated | ☐ |
| Q6 | Uptime = 100% in 48h | UptimeRobot / Better Uptime confirmed | ☐ |
| Q7 | No hot-issue support tickets that weren't quickly resolvable | Clean | ☐ |

---

## Summary dashboard

Fill this before you hit "public launch":

```
Section                        Total   Passed   Failed   Blocked
A. Auth flows                    8      __       __       __
B. Core browsing UX             14      __       __       __
C. Detail modal                  9      __       __       __
D. Bookmarks/likes/views         9      __       __       __
E. Feedback + threading         11      __       __       __
F. Admin panel                  12      __       __       __
G. Legal + navigation            9      __       __       __
H. Payment flow                 12      __       __       __
I. Security (RLS)               11      __       __       __
J. Rate limits                   6      __       __       __
K. Mobile responsive            10      __       __       __
L. Performance                  10      __       __       __
M. Cross-browser                 8      __       __       __
N. Error handling                8      __       __       __
O. Edge functions                8      __       __       __
P. Backup + rollback             5      __       __       __
Q. Canary 48h                    7      __       __       __
                              ─────  ──────   ──────   ──────
Total                          167       0        0        0

Launch gate: >= 90% of A-G, 100% of H, I, P, Q. K/L/M can have known
gaps if noted in issues log.
```

---

## Testing environment sequence

**Order in which sections apply:**

- **Local dev (localhost:5175):** A, B, C, D, E, F, G, N
- **Staging Supabase (before prod):** I, J, O, P
- **Staging Vercel deploy:** K, L, M
- **Prod deploy under wraps:** Q (canary), then re-verify H with real money

**Do NOT run I / J / P against your prod Supabase.** RLS lockdown, rate-limit
burst tests, and rollback drills all mutate DB state — do them on staging.

**Do NOT flip `VITE_USE_CLERK_SUPABASE_JWT=true` on prod** until every
Section I test passes on staging first.

---

## Timing estimate

If focused, tester-only (no dev):
- Sections A–G (functional): **3–4 hours**
- Section H (payment): **2 hours** once Dodo is wired
- Sections I–J (security / rate limits): **2 hours**
- Sections K–M (mobile / perf / cross-browser): **2 hours**
- Sections N–O (errors / edge fns): **1 hour**
- Sections P–Q (backup / canary): **wall-clock 48h + 1 hour testing**

**Total active testing time: ~10–12 hours across 4–5 days.**
Plus 48h canary window.
