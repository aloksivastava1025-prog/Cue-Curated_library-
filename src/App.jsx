import React, { useState, useEffect, useRef } from 'react';
import { SignInButton, useUser, AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import CueUserMenu from './components/CueUserMenu.jsx';
import WhatsAppButton from './components/WhatsAppButton.jsx';
import Lenis from 'lenis';
import Modal from './components/Modal.jsx';
import Admin from './pages/Admin.jsx';
import AdminInbox from './pages/AdminInbox.jsx';
import AdminPolls from './pages/AdminPolls.jsx';
import AdminSubscriptions from './pages/AdminSubscriptions.jsx';
import AdminCustomPacks from './pages/AdminCustomPacks.jsx';
import HireModal from './components/HireModal.jsx';
import Pricing from './pages/Pricing.jsx';
import Legal from './pages/Legal.jsx';
import Saved from './pages/Saved.jsx';
import Billing from './pages/Billing.jsx';
import Contact from './pages/Contact.jsx';
import Footer from './components/Footer.jsx';
import EditorialCard from './components/EditorialCard.jsx';
import FeaturedRail from './components/FeaturedRail.jsx';
import CategoryRail from './components/CategoryRail.jsx';
import TagFilter, { normalizeTag, deriveItemTags } from './components/TagFilter.jsx';
import TierFilter from './components/TierFilter.jsx';
import { isPremium as isPremiumItem } from './lib/promptHelpers.js';
import WaitlistCTA from './components/WaitlistCTA.jsx';
import WelcomeCard from './components/WelcomeCard.jsx';
import FounderDock from './components/FounderDock.jsx';
import FoundingPoll from './components/FoundingPoll.jsx';
import CouponTimer from './components/CouponTimer.jsx';
import { COUPON_ENABLED } from './lib/features.js';
import FeedbackModal from './components/FeedbackModal.jsx';
import UserInbox from './components/UserInbox.jsx';
import NavMenu from './components/NavMenu.jsx';
import FloatingNav from './components/FloatingNav.jsx';
import SignInCard from './components/SignInCard.jsx';
import { Analytics as VercelAnalytics } from '@vercel/analytics/react';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { AppProvider, useApp } from './context/AppContext.jsx';
import { identify as identifyAnalytics, resetAnalytics } from './lib/analytics.js';
import { backend } from './lib/backend.js';

const FOUNDING_CAP = 50;
import { usePageMeta } from './hooks/usePageMeta.js';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import NotFound from './pages/NotFound.jsx';
import './styles/overhaul.css';

// Rotating hero headlines — a new single word is picked on every page load/refresh.
const HEADLINES = [
  'Collection',
  'Curated',
  'Motion',
  'Craft',
  'Wonder',
  'Spectacle',
  'Signature',
  'Marvel',
  'Kinetic',
  'Editorial',
  'Momentum',
  'Showcase',
];

// Categorize an item as "section" (a self-contained page piece) vs
// "interaction" (a smaller effect/animation/behavior).
//
// Priority: use the explicit `component_type` field that the admin sets
// (or the AI suggests) on the item. Only fall back to keyword matching
// on the category when the field is unset — this keeps legacy items and
// items where the admin hasn't chosen a type from disappearing from the
// grid entirely.
const SECTION_KEYWORDS = [
  'section', 'layout', 'nav', 'form', 'gallery',
  'slider', 'marquee', 'page transition',
];
// Bucket the raw resource count into aspirational marketing bands.
// Under 20 we still show the exact number so the very first days of
// the library don't lie about scale. From 20+ we round up to the
// next round milestone so the badge reads slightly ahead of reality
// — the "we have 120+, aiming for 150" framing beats "we have 119".
// Resolve the current route as a "#/foo" string, whether the URL
// uses the legacy hash form (#/pricing) OR the new SEO-friendly
// path form (/pricing). Every route-check in the app compares
// against '#/…' shape, so we normalise pathnames into that shape
// here — path '/pricing' → '#/pricing'. Root '/' with no hash =
// empty route (home).
function getRoute() {
  if (typeof window === 'undefined') return '';
  const h = window.location.hash;
  if (h && h.length > 1) return h;
  const p = window.location.pathname;
  if (!p || p === '/') return '';
  return '#' + p;
}

function bucketCount(n) {
  const x = Number(n) || 0
  if (x < 20)  return String(x)
  if (x < 40)  return '25+'
  if (x < 75)  return '50+'
  if (x < 100) return '75+'
  if (x < 130) return '120+'
  if (x < 175) return '150+'
  if (x < 225) return '200+'
  if (x < 275) return '250+'
  if (x < 400) return '300+'
  if (x < 600) return '500+'
  if (x < 850) return '750+'
  return '1000+'
}

function itemType(item) {
  const explicit = item?.component_type;
  if (explicit === 'section' || explicit === 'interaction') return explicit;
  const cat = String(item?.category || '').toLowerCase();
  return SECTION_KEYWORDS.some((k) => cat.includes(k)) ? 'section' : 'interaction';
}

// Receipt icon for the Clerk UserButton custom menu item.
function BillingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 1.5v13l1.5-1 1.5 1 1.5-1 1.5 1 1.5-1 1.5 1v-13" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
      <path d="M5.5 5h5M5.5 8h5M5.5 11h3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
    </svg>
  )
}
// Envelope icon for the Contact menu item.
function ContactIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M2 4.5l6 4 6-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function MainApp() {
  const [selectedItem, setSelectedItem] = useState(null);
  // Route source-of-truth: hash first (legacy), then pathname (new
  // SEO-friendly URLs like /pricing). Once we've migrated all links
  // to real paths, hash support stays as a redirect shim so old
  // bookmarks + Google's discovered hash URLs still resolve.
  const [route, setRoute] = useState(getRoute());
  const [headline] = useState(() => HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'sections' | 'interactions'
  const [tierFilter, setTierFilter] = useState('all'); // 'all' | 'free' | 'paid'
  const [sortOrder, setSortOrder] = useState('newest'); // 'newest' | 'oldest'
  const [tagsFilter, setTagsFilter] = useState([]);    // array of lowercase tags (OR match)
  const [hireOpen, setHireOpen] = useState(false);
  // Global event handle so the Footer (or anywhere else out of
  // MainApp's tree) can request the Hire modal without prop drilling.
  useEffect(() => {
    const open = () => setHireOpen(true);
    window.addEventListener('cue:openHire', open);
    return () => window.removeEventListener('cue:openHire', open);
  }, []);
  // Local suggest opener → context (single source of truth for the modal).
  const { user, isSignedIn } = useUser();
  const isAdmin = isSignedIn && ['akashkumar7653099@gmail.com', 'aloksivastava1025@gmail.com', 'aloks.int@teachforindia.org'].includes(user?.primaryEmailAddress?.emailAddress);
  // Two-stage nav: normal top nav on the hero, floating bottom pill
  // once the user scrolls past a threshold. Uses rAF polling of
  // window.scrollY so it stays correct across route changes (a
  // sentinel-DOM approach broke when the home markup unmounts, the
  // ref goes stale, and the observer keeps watching a detached node)
  // AND across Lenis smooth scroll (which swallows the native scroll
  // event stream).
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  useEffect(() => {
    const THRESHOLD = 400;
    let rafId = 0;
    let current = false;
    const tick = () => {
      const y = window.scrollY;
      const next = y > THRESHOLD;
      if (next !== current) {
        current = next;
        setScrolledPastHero(next);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // Bind Clerk user_id to PostHog once signed in so pre-signin
  // pageviews stitch into the same profile as post-signin events.
  // Reset on sign-out so a fresh visitor on the same browser isn't
  // attributed to the previous account.
  useEffect(() => {
    if (isSignedIn && user) identifyAnalytics(user);
    else if (!isSignedIn) resetAnalytics();
  }, [isSignedIn, user?.id]);

  // Live founding-spot counter — surfaces scarcity on the homepage
  // so a visitor who never scrolls to /pricing still sees the cap.
  const [foundingCount, setFoundingCount] = useState(0);
  useEffect(() => {
    let alive = true;
    backend.getFoundingCount()
      .then((n) => { if (alive) setFoundingCount(n); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  // Cue+ plan lookup — used to badge the signed-in avatar so paying
  // members get a permanent visual acknowledgement of their status.
  const [userPlan, setUserPlan] = useState('free');
  useEffect(() => {
    let alive = true;
    if (!isSignedIn || !user?.id) { setUserPlan('free'); return; }
    backend.getMyProfile(user.id, user)
      .then((p) => { if (alive) setUserPlan(p?.plan || 'free'); })
      .catch(() => { if (alive) setUserPlan('free'); });
    return () => { alive = false; };
  }, [isSignedIn, user?.id]);
  const isCuePlus = userPlan === 'cue_plus' || userPlan === 'cue_plus_team';
  const spotsLeft = Math.max(FOUNDING_CAP - foundingCount, 0);
  // Hero pill flips to coupon-hunt copy while the 24-hour founding
  // window is still open and the visitor hasn't already unlocked
  // CUE49. The hook re-ticks internally every 30s so the chip
  // counts down without needing an outer clock.
  // Hero pill is now a static "with MCP · $99 lifetime" message —
  // dropped the coupon-hunt timer since MCP support is the headline
  // instead. Keep useCouponHeroLabel() available for other surfaces.
  const couponLabel = null;
  const foundingFilled = spotsLeft === 0;

  const { allPrompts, bookmarkedIds, loadingDrafts, openFeedback, filter, updateFilter } = useApp();
  const { openAuth } = useAuth();

  // Anon users can browse the first 12 cards visually AND open up to
  // 2 of them via click (a small taste that makes the sign-in feel
  // earned instead of blocking). On the 3rd click the sign-up modal
  // opens instead of the item modal. Counter resets on sign-in so a
  // returning session that lapses starts a fresh budget.
  const ANON_OPEN_LIMIT = 2;
  const openItem = (item) => {
    if (isSignedIn) { setSelectedItem(item); return; }
    let used = 0;
    try { used = parseInt(localStorage.getItem('cue_anon_opens') || '0', 10) || 0; } catch {}
    if (used >= ANON_OPEN_LIMIT) { openAuth('sign-up'); return; }
    try { localStorage.setItem('cue_anon_opens', String(used + 1)); } catch {}
    setSelectedItem(item);
  };
  useEffect(() => {
    if (isSignedIn) { try { localStorage.removeItem('cue_anon_opens'); } catch {} }
  }, [isSignedIn]);
  // Search state — free-text search over the whole library. Trigger
  // paths: (1) mouse hover in the top viewport strip on desktop,
  // (2) ⌘K / Ctrl+K, (3) FloatingNav search icon on mobile.
  const [searchInput, setSearchInput] = useState(filter?.q || '');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => updateFilter && updateFilter({ q: searchInput }), 120);
    return () => clearTimeout(t);
  }, [searchInput, updateFilter]);
  useEffect(() => {
    const HOVER_ZONE = 140;
    const onMove = (e) => {
      if (!scrolledPastHero) return;
      setSearchOpen(e.clientY <= HOVER_ZONE);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') { setSearchOpen(false); setSearchInput(''); }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 100); }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [scrolledPastHero]);
  useEffect(() => { if (!scrolledPastHero) setSearchOpen(false); }, [scrolledPastHero]);
  useEffect(() => {
    if (searchOpen) {
      const t = setTimeout(() => searchInputRef.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [searchOpen]);
  const savedCount = bookmarkedIds?.size || 0;
  usePageMeta({
    title: 'Cue — the Awwwards-tier UI component library',
    description: 'Cue is a curated UI component library — Awwwards-tier animations, hero flows, and interactions hand-picked by a founder-designer. Every Cue component ships with an AI prompt for Cursor, v0, Bolt, and Claude. Join Cue+ at $99 lifetime.',
  });

  // "Design of the Day" rail — items admin flagged with rail = 'featured'.
  // Newest featured first, capped so the row stays scan-able.
  // Supabase returns rows with created_at (snake_case); seed data may still
  // use createdAt. Accept both.
  const itemDate = (p) => new Date(p.created_at || p.createdAt || 0).getTime();
  const featured = allPrompts
    .filter((p) => p.rail === 'featured')
    .sort((a, b) => itemDate(b) - itemDate(a))
    .slice(0, 20);

  // Signed-in users get a pure date sort so their scroll matches their
  // Sort selection exactly (New/Old). Anonymous users get a temptation
  // sort — featured + paid components float to the top of the grid so
  // the first 12 they see (before the sign-up wall) are the strongest
  // conversion bait. As soon as they sign in, the sort snaps back to
  // pure date order, matching the signed-in experience across every
  // other page.
  const sortedByNewest = [...allPrompts].sort((a, b) => {
    if (!isSignedIn) {
      const aFeat = a.rail === 'featured' ? 1 : 0;
      const bFeat = b.rail === 'featured' ? 1 : 0;
      if (aFeat !== bFeat) return bFeat - aFeat;
      const aPaid = isPremiumItem(a) ? 1 : 0;
      const bPaid = isPremiumItem(b) ? 1 : 0;
      if (aPaid !== bPaid) return bPaid - aPaid;
    }
    return sortOrder === 'oldest'
      ? itemDate(a) - itemDate(b)
      : itemDate(b) - itemDate(a);
  });

  const matchesType = (p) => {
    if (typeFilter === 'all') return true;
    const t = itemType(p);
    return typeFilter === 'sections' ? t === 'section' : t === 'interaction';
  };
  const matchesTier = (p) => {
    if (tierFilter === 'all') return true;
    const paid = isPremiumItem(p);
    return tierFilter === 'paid' ? paid : !paid;
  };
  const matchesTags = (p) => {
    if (!tagsFilter.length) return true;
    // Include title/category-derived semantic tags so filters like
    // "hero" catch items the admin only tagged with implementation
    // details (preloader, scroll-pin) but whose title reads "Landing".
    const itemTags = deriveItemTags(p);
    // OR: item matches if it carries ANY of the selected tags.
    return tagsFilter.some((t) => itemTags.includes(t));
  };

  const matchesQuery = (p) => {
    const q = String(filter?.q || '').trim().toLowerCase();
    if (!q) return true;
    const derived = deriveItemTags(p).join(' ');
    const rawTags = Array.isArray(p.tags) ? p.tags.join(' ') : '';
    const stack = Array.isArray(p.stack) ? p.stack.join(' ') : '';
    const hay = [p.title, p.description, p.category, p.use_case, rawTags, derived, stack, p.id]
      .map((s) => String(s || '').toLowerCase()).join(' ');
    return q.split(/\s+/).every((tok) => hay.includes(tok));
  };
  const visiblePrompts = sortedByNewest.filter((p) => matchesType(p) && matchesTier(p) && matchesTags(p) && matchesQuery(p));
  const counts = {
    all: allPrompts.length,
    sections: allPrompts.filter((p) => itemType(p) === 'section').length,
    interactions: allPrompts.filter((p) => itemType(p) === 'interaction').length,
    free: allPrompts.filter((p) => !isPremiumItem(p)).length,
    paid: allPrompts.filter((p) =>  isPremiumItem(p)).length,
  };
  const clearFilters = () => { setTypeFilter('all'); setTierFilter('all'); setTagsFilter([]); };
  const anyFilterOn = typeFilter !== 'all' || tierFilter !== 'all' || tagsFilter.length > 0;

  useEffect(() => {
    const handleRoute = () => {
      setRoute(getRoute());
      window.scrollTo(0, 0);
      setScrolledPastHero(false);
    };
    // Listen to BOTH hashchange (legacy hash routing) AND popstate
    // (real path routing when links use pushState / <a href="/x">).
    window.addEventListener('hashchange', handleRoute);
    window.addEventListener('popstate', handleRoute);
    return () => {
      window.removeEventListener('hashchange', handleRoute);
      window.removeEventListener('popstate', handleRoute);
    };
  }, []);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // Admin is a form-heavy page — smooth scroll adds nothing there and just
    // costs frame budget. Skip Lenis entirely on the admin route.
    if (route === '#/admin') return;

    const lenis = new Lenis({
      // Gentle wheel/trackpad smoothing on desktop; native touch on
      // mobile. Earlier syncTouch + 2.2x touchMultiplier + 0.085 lerp
      // combo made mobile swipes fly and blocked horizontal scrollers
      // (Signature picks). This config keeps desktop glide but leaves
      // touch handling to the browser, which is what users expect.
      duration: 0.9,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      smoothTouch: false,
      wheelMultiplier: 1,
      touchMultiplier: 1,
      lerp: 0.14,
      gestureOrientation: 'vertical',
    });

    let rafId;
    const raf = (time) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [route]);

  if (route === '#/admin/inbox' && isAdmin) {
    return <AdminInbox />;
  }
  if (route === '#/admin/polls' && isAdmin) {
    return <AdminPolls />;
  }

  if (route === '#/admin/subscriptions' && isAdmin) {
    return <AdminSubscriptions />;
  }
  if (route === '#/admin/custom-packs' && isAdmin) {
    return <AdminCustomPacks />;
  }

  if (route === '#/admin' && isAdmin) {
    return <Admin />;
  }

  if (route === '#/pricing') {
    return <Pricing />;
  }

  if (route === '#/saved') {
    return <Saved />;
  }

  if (route === '#/billing/success') {
    return <Billing variant="success" />;
  }

  if (route === '#/billing/cancel') {
    return <Billing variant="cancel" />;
  }

  if (route === '#/billing' || route === '#/account') {
    return <Billing variant="account" />;
  }

  if (route === '#/contact') {
    return <Contact />;
  }

  if (route.startsWith('#/legal/')) {
    const slug = route.replace('#/legal/', '');
    return <Legal slug={slug} />;
  }

  // Anything under a namespaced route we own but didn't match = 404.
  // Bare hash ("", "#", "#/") is the homepage — falls through to render.
  const KNOWN_ROUTE_PREFIXES = ['', '#', '#/'];
  const isKnownHome = KNOWN_ROUTE_PREFIXES.includes(route);
  const isNamespaced = route.startsWith('#/');
  if (!isKnownHome && isNamespaced) {
    return <NotFound />;
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', position: 'relative', fontFamily: 'var(--font-sans)', color: 'var(--text)' }}>
      {/* Top slide-down search — cursor top edge OR ⌘K trigger. */}
      <div className={`cue-topsearch${searchOpen ? ' open' : ''}`} aria-hidden={!searchOpen}>
        <div className="cue-topsearch-inner">
          <svg className="cue-topsearch-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search — try 'webgl hero', 'preloader', 'editorial'…"
            className="cue-topsearch-input"
            aria-label="Search components"
          />
          {searchInput && (
            <span className="cue-topsearch-count">{visiblePrompts.length}</span>
          )}
          <div className="cue-topsearch-kbd" aria-hidden="true">
            {searchInput ? (
              <button type="button" onClick={() => { setSearchInput(''); searchInputRef.current?.focus() }} className="cue-topsearch-clear" aria-label="Clear search">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            ) : (
              <span><kbd>⌘</kbd><kbd>K</kbd></span>
            )}
          </div>
        </div>
      </div>
      <style>{`
        .cue-topsearch {
          position: fixed; top: 0; left: 0; right: 0; z-index: 120;
          transform: translateY(-100%); opacity: 0;
          transition: transform 420ms cubic-bezier(0.34, 1.05, 0.64, 1), opacity 260ms ease;
          padding: 14px 20px 24px;
          background: linear-gradient(180deg, rgba(6,6,6,0.98) 0%, rgba(6,6,6,0.88) 50%, rgba(6,6,6,0.55) 80%, rgba(6,6,6,0) 100%);
          pointer-events: none;
        }
        .cue-topsearch.open { transform: translateY(0); opacity: 1; pointer-events: auto; }
        .cue-topsearch-inner {
          max-width: 720px; margin: 0 auto;
          display: flex; align-items: center; gap: 12px;
          padding: 13px 18px;
          background: #141416;
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 14px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06);
        }
        .cue-topsearch-icon { color: var(--text-dim); flex-shrink: 0; }
        .cue-topsearch-input {
          flex: 1; background: transparent; border: none; outline: none;
          color: var(--text); font-family: var(--font-sans);
          font-size: 14px; letter-spacing: 0.005em;
        }
        .cue-topsearch-input::placeholder { color: rgba(255,255,255,0.35); }
        .cue-topsearch-count {
          font-size: 11.5px; color: rgba(255,255,255,0.55);
          background: rgba(255,255,255,0.06);
          padding: 4px 10px; border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.08);
          white-space: nowrap;
        }
        .cue-topsearch-kbd { display: inline-flex; align-items: center; gap: 4px; color: rgba(255,255,255,0.4); font-size: 10.5px; }
        .cue-topsearch-kbd kbd {
          display: inline-flex; align-items: center; justify-content: center;
          min-width: 18px; height: 18px; padding: 0 5px;
          font-family: var(--font-sans); font-size: 10px; font-weight: 600;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 4px; color: rgba(255,255,255,0.7);
        }
        .cue-topsearch-clear {
          background: transparent; border: 1px solid rgba(255,255,255,0.10);
          cursor: pointer; color: var(--text-dim);
          width: 22px; height: 22px; border-radius: 999px;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .cue-topsearch-clear:hover { color: var(--text); background: rgba(255,255,255,0.05); }
      `}</style>
      {/* Sticky Nav */}
      <nav className="cue-nav" style={{
        position: 'sticky', top: 0, zIndex: 100,
        padding: '16px 24px',
        background: 'rgba(6,6,6,0.82)',
        backdropFilter: 'blur(14px) saturate(140%)',
        WebkitBackdropFilter: 'blur(14px) saturate(140%)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px',
        // Fade the top nav out when the floating pill takes over —
        // no slide-up, no visual artifact. Content just breathes as
        // the pill lands at the bottom.
        opacity: scrolledPastHero ? 0 : 1,
        pointerEvents: scrolledPastHero ? 'none' : 'auto',
        transition: 'opacity 260ms ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: '24px', color: 'var(--text)', letterSpacing: '-0.01em' }}>Cue<span style={{ color: 'var(--electric)' }}>.</span></div>
            <span className="cue-nav-beta" style={{
              fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
              padding: '3px 8px', borderRadius: '999px',
              background: 'rgba(204,255,0,0.14)', color: '#ccff00',
              border: '1px solid rgba(204,255,0,0.45)',
              lineHeight: 1, whiteSpace: 'nowrap',
            }}>Beta</span>
          </div>
          {/* Subtle "Hire me" text next to the logo. Deliberately not
              a bright pill — the top-right already carries the
              primary CTAs (Suggest, Menu, avatar) and adding a
              highlighted button there made the nav feel crowded. */}
          <button
            type="button"
            onClick={() => setHireOpen(true)}
            className="cue-nav-hire-inline"
            title="Hire me for a project build"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 999,
              background: 'rgba(0,0,255,0.10)',
              border: '1px solid rgba(0,0,255,0.35)',
              color: '#9b9bff',
              fontSize: 11.5, fontFamily: 'var(--font-sans)',
              letterSpacing: '0.02em', cursor: 'pointer',
              transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,255,0.18)'
              e.currentTarget.style.borderColor = 'rgba(0,0,255,0.55)'
              e.currentTarget.style.color = '#c9c9ff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(0,0,255,0.10)'
              e.currentTarget.style.borderColor = 'rgba(0,0,255,0.35)'
              e.currentTarget.style.color = '#9b9bff'
            }}
          >
            <span aria-hidden="true" style={{ width: 5, height: 5, borderRadius: 999, background: '#9b9bff' }} />
            Hire me
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="cue-nav-count" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '12px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--electric)', boxShadow: '0 0 8px var(--electric)' }}></div>
            {/* Admins see the exact live count (117, 119, ...) so
                they can spot new drops at a glance. Everyone else
                sees a bucketed "100+" — reads as a real library at
                any milestone, avoids the "87 / 92 / 111 = still
                ramping" perception problem. */}
            <span>{isAdmin ? allPrompts.length : bucketCount(allPrompts.length)}</span>
            <span className="cue-nav-count-label">&nbsp;resources</span>
          </div>
          <a href="/pricing" className="cue-nav-pricing" style={{ fontSize: '12px', color: 'var(--text)', textDecoration: 'none' }}>Pricing</a>
          <button
            onClick={() => openFeedback('nav')}
            className="cue-nav-suggest"
            title="Suggest an improvement"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', height: 30, borderRadius: 999,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text)', cursor: 'pointer',
              fontSize: 11.5, fontFamily: 'var(--font-sans)', letterSpacing: '0.02em',
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}
          >
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 8h6M9 12h6m-6 4h4M4 4h16v13H8l-4 4V4z" />
            </svg>
            <span>Suggest</span>
          </button>
          <UserInbox />
          <NavMenu
            items={[
              // Pricing lives in the top nav on desktop and gets hidden
              // via .cue-nav-pricing display:none on mobile — surface it
              // here so touch users still have one tap to reach it.
              {
                label: foundingFilled
                  ? 'Pricing'
                  : `Pricing · ${spotsLeft} left`,
                href: '#/pricing',
                icon: (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 12v8H4v-8M12 4v12M6 8l6-4 6 4" /></svg>
                ),
              },
              {
                label: 'Saved',
                href: '#/saved',
                badge: savedCount,
                hidden: !isSignedIn,
                icon: (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                ),
              },
              // Suggest is a nav button on desktop, hidden on mobile —
              // give it a home in the dropdown so a touch user can still
              // reach the feedback modal.
              {
                label: 'Suggest',
                onClick: () => openFeedback('nav-menu'),
                icon: (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 8h6M9 12h6m-6 4h4M4 4h16v13H8l-4 4V4z" /></svg>
                ),
              },
              {
                label: 'Admin',
                href: '#/admin',
                hidden: !isAdmin,
                icon: (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" /></svg>
                ),
              },
            ]}
          />
          {!isSignedIn ? (
            <button
              onClick={() => openAuth('sign-in')}
              style={{ background: 'var(--electric)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}
            >Login</button>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {isCuePlus && (
                <a
                  href="/billing"
                  aria-label="Cue+ member — view billing"
                  className="cue-nav-plus-chip"
                  style={{
                    fontSize: 9.5, fontWeight: 700, letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    color: '#ccff00',
                    padding: '3px 8px', borderRadius: 999,
                    background: 'rgba(204,255,0,0.12)',
                    border: '1px solid rgba(204,255,0,0.45)',
                    lineHeight: 1, textDecoration: 'none',
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <span style={{ fontSize: 10 }}>✦</span>
                  Cue+
                </a>
              )}
              <span className="cue-nav-firstname" style={{ fontSize: 12, color: 'var(--text)', letterSpacing: '0.01em' }}>
                {user?.firstName || (user?.primaryEmailAddress?.emailAddress || '').split('@')[0]}
              </span>
              <CueUserMenu />
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="cue-hero" style={{ padding: '100px 32px 60px', position: 'relative', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          {/* Pre-headline pill — pixel-matched to the user's Tailwind
              reference (bg-white/10 · ring-1 ring-white/15 ·
              backdrop-blur · inner bg-white/90 text-neutral-900).
              Right label carries a Cue-native tagline instead of
              'Agentic AI — Built for SMBs'. */}
          {/* Discord CTA pill — proper button so it clearly reads as
              clickable, not a caption. Discord blurple background,
              white text, subtle glow + pulse-dot to signal an active
              community. Positioned above the hero pill so it's the
              first thing users notice on the page. */}
          <div className="cue-discord-wrap" style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <a
              href="https://discord.gg/NxuKbhFjP"
              target="_blank"
              rel="noreferrer noopener"
              className="cue-discord-cta"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '8px 14px', borderRadius: 999,
                background: '#5865f2',
                color: '#ffffff',
                fontFamily: 'var(--font-sans)',
                fontSize: 12, fontWeight: 600, letterSpacing: '0.01em',
                textDecoration: 'none',
                boxShadow: '0 8px 24px -8px rgba(88,101,242,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease, filter 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.filter = 'brightness(1.08)'
                e.currentTarget.style.boxShadow = '0 12px 28px -8px rgba(88,101,242,0.7), 0 0 0 1px rgba(255,255,255,0.08) inset'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.filter = 'brightness(1)'
                e.currentTarget.style.boxShadow = '0 8px 24px -8px rgba(88,101,242,0.55), 0 0 0 1px rgba(255,255,255,0.06) inset'
              }}
            >
              {/* Live pulse dot */}
              <span aria-hidden="true" style={{
                width: 8, height: 8, borderRadius: 999,
                background: '#ffffff',
                boxShadow: '0 0 8px rgba(255,255,255,0.9)',
                animation: 'cue-live-pulse 2s ease-in-out infinite',
              }} />
              {/* Discord logo */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.211.375-.444.865-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.246.198.373.292a.077.077 0 0 1-.006.127 12.298 12.298 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.363 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.055c.5-5.177-.838-9.674-3.548-13.66a.06.06 0 0 0-.031-.028zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.096 2.157 2.418 0 1.334-.955 2.42-2.157 2.42zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.211 0 2.176 1.096 2.157 2.418 0 1.334-.946 2.42-2.157 2.42z"/>
              </svg>
              <span>Join Discord — pick the next drop &amp; it&apos;s yours</span>
              <span aria-hidden="true" style={{ opacity: 0.9 }}>→</span>
            </a>
          </div>
          <style>{`
            @keyframes cue-live-pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
            /* Desktop-only optical alignment nudge — the Discord pill
               reads slightly left of the MCP pill because the MCP
               pill's chip skews its visual center. Shift the pill
               ~24px right on wider screens so both pills share the
               same optical center; mobile stays true-centered. */
            @media (min-width: 900px) {
              .cue-discord-wrap { padding-left: 56px; }
            }
          `}</style>
          <div className="cue-hero-pill-wrap" style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <a href="/pricing" className="cue-hero-pill" style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,       /* gap-3 */
              flexWrap: 'wrap', justifyContent: 'center',
              maxWidth: 'calc(100vw - 24px)',
              padding: '8px 10px',                                          /* py-2 px-2.5 */
              /* Slightly 3D / embossed — brighter top-highlight, deeper
                 bottom-shadow, plus a soft outer drop-shadow so the
                 pill visibly lifts off the hero background. Not a full
                 raised button, just enough "solid" feel that it reads
                 as a real object, not a flat overlay. */
              background: 'linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.10) 55%, rgba(255,255,255,0.04) 100%)',
              boxShadow: [
                'inset 0 1.5px 0 rgba(255,255,255,0.35)',   /* top highlight */
                'inset 0 -1.5px 0 rgba(0,0,0,0.35)',        /* bottom shadow */
                'inset 0 0 0 1px rgba(255,255,255,0.14)',   /* ring */
                '0 2px 4px rgba(0,0,0,0.35)',               /* close drop */
                '0 10px 30px -10px rgba(0,0,0,0.55)',       /* soft ambient */
                '0 0 0 1px rgba(0,0,0,0.4)',                /* dark outer edge to separate from bg */
              ].join(', '),
              backdropFilter: 'blur(10px) saturate(140%)',
              WebkitBackdropFilter: 'blur(10px) saturate(140%)',
              borderRadius: 9999,                                           /* rounded-full */
              textDecoration: 'none',
              position: 'relative',
              overflow: 'hidden',
              transition: 'transform 0.2s ease, background 0.2s ease',
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center',
                fontSize: 12, fontWeight: 500,                              /* text-xs font-medium */
                color: '#171717',                                           /* text-neutral-900 */
                background: 'rgba(255,255,255,0.90)',                       /* bg-white/90 */
                borderRadius: 9999,                                         /* rounded-full */
                padding: '2px 8px',                                          /* py-0.5 px-2 */
                fontFamily: 'var(--font-sans)',
                lineHeight: 1.4,
              }}>TODAY</span>
              <span style={{
                fontSize: 14, fontWeight: 500,                              /* text-sm font-medium */
                color: 'rgba(255,255,255,0.90)',                            /* text-white/90 */
                fontFamily: 'var(--font-sans)',
                lineHeight: 1.4,
              }}>
                <s style={{ opacity: 0.55, textDecorationThickness: 1 }}>$99</s>{' '}
                <b style={{ fontWeight: 600 }}>$79 lifetime</b>
              </span>
            </a>
          </div>
          <style>{`
            @keyframes cue-hero-pill-in {
              from { opacity: 0; transform: translateY(-8px); }
              to   { opacity: 1; transform: translateY(0);    }
            }
            /* Slow, subtle diagonal shimmer — makes the pill read as
               polished glass without becoming a "loading" state. */
            @keyframes cue-hero-pill-shine {
              0%   { transform: translateX(-120%) skewX(-18deg); opacity: 0; }
              20%  { opacity: 0.55; }
              60%  { opacity: 0.55; }
              100% { transform: translateX(220%)  skewX(-18deg); opacity: 0; }
            }
            .cue-hero-pill {
              animation: cue-hero-pill-in 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
            }
            /* Desktop-only optical shift — italic hero wordmark biases
               visual center rightward, so we nudge the pill to match.
               Mobile keeps it geometrically centered (short viewport
               = the shift pushes the pill off-canvas). */
            @media (min-width: 720px) {
              .cue-hero-pill-wrap { transform: translateX(28px); }
            }
            /* The shine strip — a thin bright band that sweeps across
               the pill every 6 seconds. Sits above content but below
               any interactive elements via pointer-events: none. */
            .cue-hero-pill::after {
              content: '';
              position: absolute;
              top: 0; bottom: 0;
              left: 0;
              width: 40%;
              background: linear-gradient(90deg,
                transparent 0%,
                rgba(255,255,255,0.18) 45%,
                rgba(255,255,255,0.28) 50%,
                rgba(255,255,255,0.18) 55%,
                transparent 100%);
              transform: translateX(-120%) skewX(-18deg);
              pointer-events: none;
              animation: cue-hero-pill-shine 6s ease-in-out infinite;
              animation-delay: 2s;
            }
            .cue-hero-pill:hover {
              transform: translateY(-1px);
              background: linear-gradient(180deg, rgba(255,255,255,0.22) 0%, rgba(255,255,255,0.10) 45%, rgba(255,255,255,0.06) 100%) !important;
            }
          `}</style>
          <h1 className="cue-hero-title" style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 'clamp(56px, 13vw, 200px)', fontStyle: 'italic', letterSpacing: '-0.035em', lineHeight: 0.9, color: 'var(--text)' }}>
            {headline}
          </h1>
          <div style={{ marginTop: '24px', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '26px', color: 'var(--text)' }}>
            New drop <span style={{ color: 'var(--electric)' }}>today</span>
          </div>
          <p style={{ margin: '36px auto 0', maxWidth: '580px', fontSize: '14.5px', color: 'var(--text-dim)', lineHeight: 1.65 }}>
            The best web interactions — from Awwwards, CollectUI and X — with the code + prompt to recreate them in your own project.
          </p>
          <WaitlistCTA source="newsletter-hero" />
          {/* Subtle 24-hour founding-rate ticker — muted grey below
              the CTA. Visible enough to notice, quiet enough to not
              feel like a carnival banner. */}
          {COUPON_ENABLED && (
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center' }}>
              <CouponTimer />
            </div>
          )}
          {/* Hire-me CTA — highest-ticket offering, sits above the
              custom-pricing nudge so buyers who want a whole build see
              the fastest path to talking to Alok. Uses the electric
              chip style so it reads as a real product, not a
              secondary link. */}
          <div style={{
            marginTop: 18, display: 'flex', justifyContent: 'center',
            fontFamily: 'var(--font-sans)',
          }}>
            <button
              type="button"
              onClick={() => setHireOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 10,
                padding: '9px 18px',
                background: 'var(--electric, #0000ff)',
                border: 'none',
                borderRadius: 999,
                color: '#fff',
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.02em',
                boxShadow: '0 8px 24px rgba(0,0,255,0.28)',
                transition: 'transform 120ms ease, box-shadow 120ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)'
                e.currentTarget.style.boxShadow = '0 12px 28px rgba(0,0,255,0.38)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,255,0.28)'
              }}
            >
              <span aria-hidden="true" style={{
                width: 6, height: 6, borderRadius: 999,
                background: 'rgba(255,255,255,0.9)',
              }} />
              Hire me — build a site that stands out
              <span style={{ opacity: 0.7 }}>→</span>
            </button>
          </div>

          {/* Custom-pricing nudge — announces the à-la-carte option
              to buyers who don't want the full library. Small, muted,
              opt-in — sits under the coupon timer so anyone hesitating
              on the founding price sees an escape hatch. */}
          <div style={{
            marginTop: 14, display: 'flex', justifyContent: 'center',
            fontFamily: 'var(--font-sans)', fontSize: 12,
          }}>
            <a href="/pricing" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '5px 12px',
              border: '1px dashed rgba(255,255,255,0.22)',
              borderRadius: 999,
              color: 'rgba(255,255,255,0.72)',
              textDecoration: 'none',
              letterSpacing: '0.02em',
              transition: 'color 120ms ease, border-color 120ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = '#fff'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.45)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'rgba(255,255,255,0.72)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'
            }}>
              <span style={{
                display: 'inline-block', width: 6, height: 6, borderRadius: 999,
                background: 'var(--electric, #0000ff)',
              }} />
              New — Custom pricing · pay only for the components you pick →
            </a>
          </div>
        </div>
      </section>

      {/* Design of the Day rail — only rendered if there are featured items */}
      <FeaturedRail items={featured} onOpen={openItem} />

      {/* Single WebGL "Signature" rail — the one category that most
          differentiates Cue from every other component library on
          the market. Kept as the sole category rail; the filter bar
          below is where visitors browse everything else. Uses the
          same deriveItemTags logic the filter bar uses so the count
          matches the number visitors see in the filter chip. */}
      {(() => {
        // Rail filter honours the admin override first, falls back
        // to deriveItemTags:
        //   featured_webgl = true   → always include (override in)
        //   featured_webgl = false  → always exclude (override out)
        //   null / undefined        → auto-detect via tags
        const isWebGL = (p) => {
          if (p.featuredWebgl === true) return true
          if (p.featuredWebgl === false) return false
          return (deriveItemTags(p) || []).some(
            (t) => String(t).toLowerCase() === '3d & webgl'
          )
        }
        const items = (allPrompts || []).filter(isWebGL)
        return (
          <CategoryRail
            eyebrow="Signature category"
            title="WebGL"
            items={items}
            onOpen={openItem}
          />
        )
      })()}

      {/* Filter bar — 3-column grid so the center toggle is TRULY centered
          regardless of how wide the left/right dropdowns get. */}
      <div className="cue-filter-bar" style={{
        maxWidth: '1500px', margin: '0 auto',
        padding: '12px 24px 4px',
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        gap: 12,
      }}>
        {/* Left: tag dropdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifySelf: 'start' }}>
          <TagFilter items={allPrompts} selected={tagsFilter} onChange={setTagsFilter} />
          {anyFilterOn && (
            <button
              onClick={clearFilters}
              style={{
                padding: '6px 12px', height: 30, borderRadius: 999,
                background: 'transparent', color: 'var(--text-dim)',
                border: '1px solid var(--border)',
                fontSize: 11, cursor: 'pointer', letterSpacing: '0.02em',
              }}
            >Clear all</button>
          )}
        </div>

        {/* Center: type segmented control */}
        <div style={{ display: 'inline-flex', padding: 4, background: '#0e0e10', border: '1px solid var(--border)', borderRadius: 999, gap: 2, justifySelf: 'center' }}>
          {[
            { key: 'all',          label: 'All',          count: counts.all },
            { key: 'sections',     label: 'Sections',     count: counts.sections },
            { key: 'interactions', label: 'Interactions', count: counts.interactions },
          ].map((t) => {
            const on = typeFilter === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTypeFilter(t.key)}
                style={{
                  padding: '8px 18px', borderRadius: 999,
                  background: on ? 'var(--electric)' : 'transparent',
                  color: on ? '#fff' : 'var(--text-dim)',
                  border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
                  transition: 'background 0.2s ease, color 0.2s ease',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}
              >
                <span>{t.label}</span>
                <span style={{ fontSize: 10, opacity: on ? 0.85 : 0.6 }}>{t.count}</span>
              </button>
            );
          })}
        </div>

        {/* Right: sort + tier */}
        <div style={{ justifySelf: 'end', display: 'flex', alignItems: 'center', gap: 8 }}>
          <SortToggle value={sortOrder} onChange={setSortOrder} />
          <TierFilter value={tierFilter} counts={counts} onChange={setTierFilter} />
        </div>
      </div>

      {/* Selected tag chips — user sees exactly what's applied */}
      {tagsFilter.length > 0 && (
        <div style={{
          maxWidth: '1500px', margin: '0 auto', padding: '10px 24px 0',
          display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center',
        }}>
          <span style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600, marginRight: 4 }}>Filtered by</span>
          {tagsFilter.map((tag) => (
            <button
              key={tag}
              onClick={() => setTagsFilter(tagsFilter.filter((t) => t !== tag))}
              title="Remove"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 10px 4px 12px', borderRadius: 999,
                background: 'rgba(0,0,255,0.10)', border: '1px solid rgba(0,0,255,0.35)',
                color: 'var(--text)', fontSize: 11.5, cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <span>{tag}</span>
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          ))}
          <button
            onClick={() => setTagsFilter([])}
            style={{
              marginLeft: 4, padding: '4px 10px', borderRadius: 999,
              background: 'transparent', border: '1px solid var(--border)',
              color: 'var(--text-dim)', fontSize: 10.5, cursor: 'pointer',
              letterSpacing: '0.06em', textTransform: 'uppercase',
            }}
          >Clear</button>
        </div>
      )}

      {/* Grid Section */}
      <section className="cue-grid" style={{ padding: '20px 24px 120px', maxWidth: '1500px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', columnGap: '24px', rowGap: '48px' }}>
        {loadingDrafts && allPrompts.length === 0 ? (
          Array.from({ length: 9 }).map((_, i) => (
            <div key={`sk-${i}`} aria-hidden="true" style={{
              background: 'var(--card-bg)', borderRadius: 14, overflow: 'hidden',
              opacity: 0.6, animation: 'cuePulse 1.5s ease-in-out infinite',
              animationDelay: `${i * 0.06}s`,
            }}>
              <div style={{ aspectRatio: '16 / 10', margin: '8px 8px 0', borderRadius: 8, background: '#141416' }} />
              <div style={{ padding: '16px 16px 18px' }}>
                <div style={{ height: 12, borderRadius: 4, background: '#1c1c1e', width: '70%', marginBottom: 8 }} />
                <div style={{ height: 8, borderRadius: 4, background: '#141416', width: '40%' }} />
              </div>
            </div>
          ))
        ) : visiblePrompts.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 20px' }}>
            {allPrompts.length === 0 ? (
              <>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-dim)', marginBottom: '18px' }}>Empty library</div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '44px', fontStyle: 'italic', fontWeight: 400, color: 'var(--electric)', marginBottom: '18px' }}>Add your first resource</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', maxWidth: '520px', margin: '0 auto 32px' }}>Your library is empty. Head to the admin panel to add projects, screenshots, or videos.</p>
                {isAdmin && <a href="/admin" style={{ display: 'inline-block', padding: '10px 20px', background: 'var(--electric)', color: '#fff', borderRadius: '3px', textDecoration: 'none', fontSize: '13px', fontWeight: 500, boxShadow: '0 6px 24px -8px rgba(0,0,255,0.6)' }}>Open admin &rarr;</a>}
              </>
            ) : (
              <>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-dim)', marginBottom: '18px' }}>No results</div>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', fontStyle: 'italic', fontWeight: 400, color: 'var(--text)', marginBottom: '16px' }}>Nothing here yet</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-dim)', maxWidth: '520px', margin: '0 auto 24px' }}>
                  No {typeFilter} in the library yet. Try a different filter, or check back after the next drop.
                </p>
                <button onClick={clearFilters} style={{ padding: '10px 20px', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '999px', cursor: 'pointer', fontSize: '12px', letterSpacing: '0.04em' }}>Clear filters</button>
              </>
            )}
          </div>
        ) : (
          (() => {
            // Mobbin-style scroll wall — anon users see the first ~12
            // components; the next ~6 render behind a heavy blur so the
            // eye reads "there's more here" but no card is actually
            // readable, and a centered sign-in CTA sits on top. Signed
            // -in users see the full grid unblurred.
            const ANON_GRID_LIMIT = 12;
            const TEASE_COUNT = 6;
            const shownItems = isSignedIn ? visiblePrompts : visiblePrompts.slice(0, ANON_GRID_LIMIT);
            const teaseItems = isSignedIn ? [] : visiblePrompts.slice(ANON_GRID_LIMIT, ANON_GRID_LIMIT + TEASE_COUNT);
            const hiddenCount = isSignedIn ? 0 : Math.max(0, visiblePrompts.length - ANON_GRID_LIMIT);
            return (
              <>
                {shownItems.map(item => (
                  <EditorialCard key={item.id} item={item} setSelectedItem={openItem} />
                ))}
                {hiddenCount > 0 && (
                  <div style={{ gridColumn: '1 / -1', position: 'relative', marginTop: 16 }}>
                    {/* Blurred tease strip — real cards behind glass so the
                        user sees there's more without reading anything. */}
                    <div
                      aria-hidden
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        columnGap: 24, rowGap: 48,
                        filter: 'blur(14px) saturate(0.7) brightness(0.85)',
                        transform: 'scale(1.02)',
                        transformOrigin: 'top center',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        // Fade the tease into the sign-in wall so the
                        // bottom of the strip disappears into the CTA.
                        maskImage: 'linear-gradient(180deg, #000 0%, rgba(0,0,0,0.85) 40%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(180deg, #000 0%, rgba(0,0,0,0.85) 40%, transparent 100%)',
                        maxHeight: 520,
                        overflow: 'hidden',
                      }}
                    >
                      {teaseItems.map((item) => (
                        <EditorialCard key={`tease-${item.id}`} item={item} setSelectedItem={() => {}} />
                      ))}
                    </div>

                    {/* CTA overlay — centered on top of the blurred strip */}
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '24px 16px',
                    }}>
                      <div style={{ textAlign: 'center', maxWidth: 520 }}>
                        <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--electric)', fontWeight: 700, marginBottom: 14 }}>
                          {hiddenCount} more components locked
                        </div>
                        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(28px, 4vw, 44px)', fontStyle: 'italic', fontWeight: 300, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: 12, lineHeight: 1.1 }}>
                          Sign in to see the rest
                        </h3>
                        <p style={{ fontSize: 14, color: 'var(--text-dim)', margin: '0 auto 24px', lineHeight: 1.55 }}>
                          Free — no card required. Sign up in 5 seconds to browse all {visiblePrompts.length} components, save favorites, and get every new drop.
                        </p>
                        <button
                          onClick={() => openAuth('sign-up')}
                          className="hover-btn-get"
                          style={{
                            padding: '13px 28px', background: 'var(--electric)', color: '#fff',
                            border: 'none', borderRadius: 999, fontSize: 14, fontWeight: 600,
                            cursor: 'pointer', letterSpacing: '0.01em',
                            boxShadow: '0 10px 28px -10px rgba(59,130,246,0.6)',
                            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                          }}
                        >
                          Sign up free — unlock 100+ more
                        </button>
                        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--text-dim)' }}>
                          Already have an account?{' '}
                          <button
                            onClick={() => openAuth('sign-in')}
                            style={{ background: 'none', border: 'none', color: 'var(--electric)', cursor: 'pointer', fontSize: 12, padding: 0, textDecoration: 'underline' }}
                          >Sign in</button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()
        )}
      </section>

      <Footer onSuggest={() => openFeedback('homepage-footer')} />

      {/* Floating bottom pill — takes over once the top nav has slid up */}
      <FloatingNav
        visible={scrolledPastHero}
        onOpenFeedback={openFeedback}
        onOpenAuth={openAuth}
        onOpenSearch={() => { setSearchOpen(true); setTimeout(() => searchInputRef.current?.focus(), 250); }}
        spotsLeft={spotsLeft}
        foundingFilled={foundingFilled}
        savedCount={savedCount}
        isAdmin={isAdmin}
      />

      <WelcomeCard
        onExploreFree={() => {
          setTierFilter('free');
          // Smooth-scroll to the grid so the user sees free items immediately.
          try {
            const grid = document.querySelector('.cue-grid') || document.querySelector('main');
            if (grid && grid.scrollIntoView) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
            else window.scrollTo({ top: 800, behavior: 'smooth' });
          } catch {}
        }}
        onSuggest={() => openFeedback('welcome-card')}
      />

      {selectedItem && (
        <Modal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}

      <HireModal open={hireOpen} onClose={() => setHireOpen(false)} />

      <FounderDock />
    </div>
  );
}

// Compact newest/oldest toggle matching the filter-bar pill vocabulary.
// Two-pill segmented control — same footprint as TierFilter so the
// right cluster reads as one row.
function SortToggle({ value, onChange }) {
  return (
    <div
      role="group"
      aria-label="Sort order"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 2,
        padding: 3,
        borderRadius: 999,
        background: 'transparent',
        border: '1px solid var(--border)',
      }}
    >
      {[
        { key: 'newest', label: 'New' },
        { key: 'oldest', label: 'Old' },
      ].map((opt) => {
        const on = value === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            aria-pressed={on}
            style={{
              padding: '5px 12px',
              height: 24,
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: on ? 'var(--electric)' : 'transparent',
              color: on ? '#fff' : 'var(--text-dim)',
              fontFamily: 'var(--font-sans)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Hero-pill hook — returns { chip, text } while the founding-rate
// window is live and the visitor hasn't unlocked the code yet.
// Reads the same localStorage keys the coupon toast / timer /
// pricing pill do so the whole hunt shares one source of truth.
function useCouponHeroLabel() {
  // Tick every second so the chip shows a live HH:MM:SS ticker.
  // Cost is a single React re-render per second on the home route
  // only — cheap enough not to matter, and the visual signal it
  // gives (real countdown) is a stronger nudge than a stale minute.
  const [tick, setTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const WINDOW_MS = 24 * 60 * 60 * 1000;
  // Unified promo expiry — same localStorage key the Pricing page's
  // PromoToggle writes so the hero pill and the founding card always
  // show the same countdown. First read wins; if nothing is set yet
  // (fresh visitor), start the 24-hour window from now.
  let expiry = 0;
  try {
    const raw = localStorage.getItem('cue.promo.newmonth.expiry');
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed) && parsed > Date.now()) {
      expiry = parsed;
    } else {
      expiry = Date.now() + WINDOW_MS;
      localStorage.setItem('cue.promo.newmonth.expiry', String(expiry));
    }
  } catch {}
  const remaining = Math.max(0, expiry - Date.now());
  if (remaining <= 0) return null;
  const totalSec = Math.floor(remaining / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n) => String(n).padStart(2, '0');
  const chip = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return {
    chip,
    text: (
      <>
        Find the coupon —{' '}
        <s style={{ opacity: 0.55, textDecorationThickness: 1 }}>$99</s>{' '}
        $79 lifetime
      </>
    ),
    _tick: tick,
  };
}

function AppShell() {
  const { feedbackOpen, feedbackSource, closeFeedback } = useApp();
  const { authOpen, authMode, closeAuth } = useAuth();
  return (
    <>
      <MainApp />
      <FeedbackModal open={feedbackOpen} onClose={closeFeedback} source={feedbackSource} />
      <SignInCard open={authOpen} mode={authMode} onClose={closeAuth} />
      {/* FoundingPoll lives at the shell level so it persists as
          the user navigates between /pricing, /account, etc. Its
          own internal state gates when it renders. */}
      <FoundingPoll />
      {/* Vercel Web Analytics — Vercel dashboard mein 'Enable' toggle
          on karna hai then data flow shuru. Zero-config beyond that,
          no cookies, no consent banner needed. */}
      <VercelAnalytics />
    </>
  );
}

export default function App() {
  // Clerk's OAuth flow redirects the browser to /sso-callback (a real
  // pathname, not a hash route). Clerk's handshake takes several seconds
  // on slow networks — without a visible loading UI the user sees a
  // black screen and thinks the site froze. Render Cue-branded skeleton
  // over the callback component so the transition feels intentional.
  if (typeof window !== 'undefined' && window.location.pathname === '/sso-callback') {
    return (
      <>
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1,
          background: '#060606',
          color: '#f2f2ef',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
          padding: 20,
        }}>
          <div style={{
            fontFamily: 'Fraunces, Georgia, serif',
            fontStyle: 'italic', fontSize: 34, fontWeight: 300,
            letterSpacing: '-0.02em',
            marginBottom: 24, color: '#f2f2ef',
          }}>Signing you in…</div>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.12)',
            borderTopColor: '#0000FF',
            animation: 'cue-spin 900ms linear infinite',
          }} />
          <div style={{
            marginTop: 22, fontSize: 12.5,
            color: 'rgba(255,255,255,0.5)',
            letterSpacing: '0.02em', textAlign: 'center',
          }}>Almost there — one moment while we finish setting up your account.</div>
          <style>{`
            @keyframes cue-spin { to { transform: rotate(360deg); } }
          `}</style>
        </div>
        <AuthenticateWithRedirectCallback
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
        />
      </>
    );
  }
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppProvider>
          <AppShell />
        </AppProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
