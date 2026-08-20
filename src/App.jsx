import React, { useState, useEffect, useRef } from 'react';
import { SignInButton, useUser, AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import CueUserMenu from './components/CueUserMenu.jsx';
import Lenis from 'lenis';
import Modal from './components/Modal.jsx';
import Admin from './pages/Admin.jsx';
import AdminInbox from './pages/AdminInbox.jsx';
import AdminSubscriptions from './pages/AdminSubscriptions.jsx';
import Pricing from './pages/Pricing.jsx';
import Legal from './pages/Legal.jsx';
import Saved from './pages/Saved.jsx';
import Billing from './pages/Billing.jsx';
import Contact from './pages/Contact.jsx';
import Footer from './components/Footer.jsx';
import EditorialCard from './components/EditorialCard.jsx';
import FeaturedRail from './components/FeaturedRail.jsx';
import TagFilter, { normalizeTag } from './components/TagFilter.jsx';
import TierFilter from './components/TierFilter.jsx';
import { isPremium as isPremiumItem } from './lib/promptHelpers.js';
import WaitlistCTA from './components/WaitlistCTA.jsx';
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
import { useScrollDirection } from './hooks/useScrollDirection.js';
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
  const [route, setRoute] = useState(window.location.hash);
  const [headline] = useState(() => HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'sections' | 'interactions'
  const [tierFilter, setTierFilter] = useState('all'); // 'all' | 'free' | 'paid'
  const [tagsFilter, setTagsFilter] = useState([]);    // array of lowercase tags (OR match)
  // Local suggest opener → context (single source of truth for the modal).
  const { user, isSignedIn } = useUser();
  const isAdmin = isSignedIn && ['akashkumar7653099@gmail.com', 'aloksivastava1025@gmail.com'].includes(user?.primaryEmailAddress?.emailAddress);
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
  const foundingFilled = spotsLeft === 0;

  const { allPrompts, bookmarkedIds, loadingDrafts, openFeedback } = useApp();
  const { openAuth } = useAuth();
  const savedCount = bookmarkedIds?.size || 0;
  usePageMeta({
    title: 'A curated library for AI-native builders',
    description: 'Every AI tool ships the same-looking hero. Cue is the taste layer that fixes that — hand-picked prompts for Bolt, v0, Cursor, and Framer.',
  });

  // "Design of the Day" rail — items admin flagged with rail = 'featured'.
  // Newest featured first, capped so the row stays scan-able.
  // Supabase returns rows with created_at (snake_case); seed data may still
  // use createdAt. Accept both.
  const itemDate = (p) => new Date(p.created_at || p.createdAt || 0).getTime();
  const featured = allPrompts
    .filter((p) => p.rail === 'featured')
    .sort((a, b) => itemDate(b) - itemDate(a))
    .slice(0, 12);

  // Grid shows EVERYTHING, featured included. Newest first — otherwise fresh
  // drops disappear into the middle of the grid and users think we stopped
  // shipping. Rail is a spotlight above, grid stays complete below.
  const sortedByNewest = [...allPrompts].sort((a, b) => itemDate(b) - itemDate(a));

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
    const itemTags = (p.tags || []).map(normalizeTag);
    // OR: item matches if it carries ANY of the selected tags.
    return tagsFilter.some((t) => itemTags.includes(t));
  };

  const visiblePrompts = sortedByNewest.filter((p) => matchesType(p) && matchesTier(p) && matchesTags(p));
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
    const handleHash = () => {
      setRoute(window.location.hash);
      // Reset scroll to top on every route change — otherwise the
      // browser preserves the previous page's y-position and the
      // new route lands mid-content (also strands the floating nav
      // in scrolled-past-hero mode until the user manually scrolls up).
      window.scrollTo(0, 0);
      setScrolledPastHero(false);
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  useEffect(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // Admin is a form-heavy page — smooth scroll adds nothing there and just
    // costs frame budget. Skip Lenis entirely on the admin route.
    if (route === '#/admin') return;

    const lenis = new Lenis({
      // Awwwards-tier scroll feel — a bit more travel + smoother lerp so
      // wheel and trackpad both glide instead of ticking. Touch feels
      // punchier so mobile users don't fight momentum.
      duration: 1.15,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // exp-out
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 2.2,
      // Lower lerp = smoother, more velvety motion (less snap-to-frame).
      lerp: 0.085,
      syncTouch: true,
      // Gestures pass through nav / dropdowns cleanly.
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

  if (route === '#/admin/subscriptions' && isAdmin) {
    return <AdminSubscriptions />;
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
            <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '24px', color: 'var(--text)' }}>CUE</div>
            <span className="cue-nav-beta" style={{
              fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
              padding: '3px 8px', borderRadius: '999px',
              background: 'rgba(204,255,0,0.14)', color: '#ccff00',
              border: '1px solid rgba(204,255,0,0.45)',
              lineHeight: 1, whiteSpace: 'nowrap',
            }}>Beta</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="cue-nav-count" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '12px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--electric)', boxShadow: '0 0 8px var(--electric)' }}></div>
            <span>{allPrompts.length}</span>
            <span className="cue-nav-count-label">&nbsp;resources</span>
          </div>
          <a href="#/pricing" className="cue-nav-pricing" style={{ fontSize: '12px', color: 'var(--text)', textDecoration: 'none' }}>Pricing</a>
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
            >Join Cue</button>
          ) : (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {isCuePlus && (
                <a
                  href="#/billing"
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

      {/* Scroll sentinel — when this leaves the viewport, we swap the
          top nav for the floating bottom pill. ~400px below the nav so
          the transition happens once the hero is out of the way. */}
      <div ref={scrollSentinelRef} aria-hidden="true" style={{ position: 'absolute', top: 400, left: 0, width: 1, height: 1, pointerEvents: 'none' }} />

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
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <a href="#/pricing" className="cue-hero-pill" style={{
              display: 'inline-flex', alignItems: 'center', gap: 12,       /* gap-3 */
              flexWrap: 'wrap', justifyContent: 'center',
              maxWidth: 'calc(100vw - 24px)',
              padding: '8px 10px',                                          /* py-2 px-2.5 */
              background: 'rgba(255,255,255,0.10)',                         /* bg-white/10 */
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',          /* ring-1 ring-white/15 */
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              borderRadius: 9999,                                           /* rounded-full */
              textDecoration: 'none',
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
              }}>Early Access</span>
              <span style={{
                fontSize: 14, fontWeight: 500,                              /* text-sm font-medium */
                color: 'rgba(255,255,255,0.90)',                            /* text-white/90 */
                fontFamily: 'var(--font-sans)',
                lineHeight: 1.4,
              }}>
                {foundingFilled
                  ? 'Founding closed — launch pricing live'
                  : `${spotsLeft} founding spots left · $99 lifetime`}
              </span>
            </a>
          </div>
          <style>{`
            @keyframes cue-hero-pill-in {
              from { opacity: 0; transform: translateY(-8px); }
              to   { opacity: 1; transform: translateY(0);    }
            }
            .cue-hero-pill {
              animation: cue-hero-pill-in 500ms cubic-bezier(0.22, 1, 0.36, 1) both;
            }
            .cue-hero-pill:hover {
              background: rgba(255,255,255,0.14) !important;
              transform: translateY(-1px);
            }
          `}</style>
          <h1 className="cue-hero-title" style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 'clamp(56px, 13vw, 200px)', fontStyle: 'italic', letterSpacing: '-0.035em', lineHeight: 0.9, color: 'var(--text)' }}>
            {headline}
          </h1>
          <div style={{ marginTop: '24px', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '26px', color: 'var(--text)' }}>
            New drop <span style={{ color: 'var(--electric)' }}>today</span>
          </div>
          <p style={{ margin: '40px auto 0', maxWidth: '540px', fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Every AI tool ships the same-looking hero. Cue is the taste layer that fixes that — hand-picked prompts for Bolt, v0, Cursor, and Framer that land you at the version worth shipping to a client.
          </p>
          <WaitlistCTA source="newsletter-hero" />
        </div>
      </section>

      {/* Design of the Day rail — only rendered if there are featured items */}
      <FeaturedRail items={featured} onOpen={setSelectedItem} />

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

        {/* Right: tier dropdown */}
        <div style={{ justifySelf: 'end' }}>
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
                {isAdmin && <a href="#/admin" style={{ display: 'inline-block', padding: '10px 20px', background: 'var(--electric)', color: '#fff', borderRadius: '3px', textDecoration: 'none', fontSize: '13px', fontWeight: 500, boxShadow: '0 6px 24px -8px rgba(0,0,255,0.6)' }}>Open admin &rarr;</a>}
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
          visiblePrompts.map(item => (
            <EditorialCard key={item.id} item={item} setSelectedItem={setSelectedItem} />
          ))
        )}
      </section>

      <Footer onSuggest={() => openFeedback('homepage-footer')} />

      {/* Floating bottom pill — takes over once the top nav has slid up */}
      <FloatingNav
        visible={scrolledPastHero}
        onOpenFeedback={openFeedback}
        onOpenAuth={openAuth}
        spotsLeft={spotsLeft}
        foundingFilled={foundingFilled}
        savedCount={savedCount}
        isAdmin={isAdmin}
      />

      {selectedItem && (
        <Modal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

function AppShell() {
  const { feedbackOpen, feedbackSource, closeFeedback } = useApp();
  const { authOpen, authMode, closeAuth } = useAuth();
  return (
    <>
      <MainApp />
      <FeedbackModal open={feedbackOpen} onClose={closeFeedback} source={feedbackSource} />
      <SignInCard open={authOpen} mode={authMode} onClose={closeAuth} />
      {/* Vercel Web Analytics — Vercel dashboard mein 'Enable' toggle
          on karna hai then data flow shuru. Zero-config beyond that,
          no cookies, no consent banner needed. */}
      <VercelAnalytics />
    </>
  );
}

export default function App() {
  // Clerk's OAuth flow redirects the browser to /sso-callback (a real
  // pathname, not a hash route). This app otherwise uses hash routing,
  // so without a handler here the page just sits blank at that URL.
  // AuthenticateWithRedirectCallback finalises the OAuth handshake and
  // then sends the user to `redirectUrl`.
  if (typeof window !== 'undefined' && window.location.pathname === '/sso-callback') {
    return (
      <AuthenticateWithRedirectCallback
        signInFallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/"
      />
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
