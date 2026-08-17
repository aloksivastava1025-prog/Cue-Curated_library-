import React, { useState, useEffect } from 'react';
import { SignInButton, UserButton, useUser } from '@clerk/clerk-react';
import Lenis from 'lenis';
import Modal from './components/Modal.jsx';
import Admin from './pages/Admin.jsx';
import AdminInbox from './pages/AdminInbox.jsx';
import Pricing from './pages/Pricing.jsx';
import Legal from './pages/Legal.jsx';
import Saved from './pages/Saved.jsx';
import Footer from './components/Footer.jsx';
import EditorialCard from './components/EditorialCard.jsx';
import FeaturedRail from './components/FeaturedRail.jsx';
import WaitlistCTA from './components/WaitlistCTA.jsx';
import FeedbackModal from './components/FeedbackModal.jsx';
import UserInbox from './components/UserInbox.jsx';
import NavMenu from './components/NavMenu.jsx';
import { AppProvider, useApp } from './context/AppContext.jsx';
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
function itemType(item) {
  const explicit = item?.component_type;
  if (explicit === 'section' || explicit === 'interaction') return explicit;
  const cat = String(item?.category || '').toLowerCase();
  return SECTION_KEYWORDS.some((k) => cat.includes(k)) ? 'section' : 'interaction';
}

function MainApp() {
  const [selectedItem, setSelectedItem] = useState(null);
  const [route, setRoute] = useState(window.location.hash);
  const [headline] = useState(() => HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'sections' | 'interactions'
  // Local suggest opener → context (single source of truth for the modal).
  const { user, isSignedIn } = useUser();
  const isAdmin = isSignedIn && ['akashkumar7653099@gmail.com', 'aloksivastava1025@gmail.com'].includes(user?.primaryEmailAddress?.emailAddress);
  const { allPrompts, bookmarkedIds, loadingDrafts, openFeedback } = useApp();
  const savedCount = bookmarkedIds?.size || 0;
  usePageMeta({
    title: 'A curated library for AI-native builders',
    description: 'Battle-tested prompts and interactions for Bolt, v0, Cursor, and Framer. Copy, paste, ship.',
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
  const visiblePrompts = typeFilter === 'all'
    ? sortedByNewest
    : sortedByNewest.filter((p) => {
        const t = itemType(p);
        return typeFilter === 'sections' ? t === 'section' : t === 'interaction';
      });
  const counts = {
    all: allPrompts.length,
    sections: allPrompts.filter((p) => itemType(p) === 'section').length,
    interactions: allPrompts.filter((p) => itemType(p) === 'interaction').length,
  };

  useEffect(() => {
    const handleHash = () => setRoute(window.location.hash);
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
      // Lighter defaults — feels immediate on wheel, still smooth on trackpad/touch.
      duration: 0.9,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
      lerp: 0.14,
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

  if (route === '#/admin' && isAdmin) {
    return <Admin />;
  }

  if (route === '#/pricing') {
    return <Pricing />;
  }

  if (route === '#/saved') {
    return <Saved />;
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
      <nav className="cue-nav" style={{ position: 'sticky', top: 0, zIndex: 100, padding: '16px 24px', background: '#060606', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', transform: 'translateZ(0)', willChange: 'transform' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '24px', color: 'var(--text)' }}>CUE</div>
            <span style={{
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
          <UserInbox />
          <NavMenu
            items={[
              {
                label: 'Saved',
                href: '#/saved',
                badge: savedCount,
                hidden: !isSignedIn,
                icon: (
                  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
                ),
              },
              {
                label: 'Suggest improvement',
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
            <SignInButton mode="modal">
              <button style={{ background: 'var(--electric)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>Join Cue</button>
            </SignInButton>
          ) : (
            <UserButton showName appearance={{ elements: { userButtonOuterIdentifier: { color: 'var(--text)', fontSize: '12px' } } }} />
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="cue-hero" style={{ padding: '100px 32px 60px', position: 'relative', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h1 className="cue-hero-title" style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 'clamp(56px, 13vw, 200px)', fontStyle: 'italic', letterSpacing: '-0.035em', lineHeight: 0.9, color: 'var(--text)' }}>
            {headline}
          </h1>
          <div style={{ marginTop: '24px', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '26px', color: 'var(--text)' }}>
            New drop <span style={{ color: 'var(--electric)' }}>today</span>
          </div>
          <p style={{ margin: '40px auto 0', maxWidth: '520px', fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.55 }}>
            Battle-tested prompts for Bolt, v0, Cursor, and Framer. Stop endlessly tweaking and start shipping. Awwwards-tier interactions saved locally.
          </p>
          <WaitlistCTA source="newsletter-hero" />
        </div>
      </section>

      {/* Design of the Day rail — only rendered if there are featured items */}
      <FeaturedRail items={featured} onOpen={setSelectedItem} />

      {/* Type filter toggle — All / Sections / Interactions */}
      <div className="cue-type-toggle" style={{ maxWidth: '1500px', margin: '0 auto', padding: '8px 24px 4px', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'inline-flex', padding: 4, background: '#0e0e10', border: '1px solid var(--border)', borderRadius: 999, gap: 2 }}>
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
                  padding: '8px 18px',
                  borderRadius: 999,
                  background: on ? 'var(--electric)' : 'transparent',
                  color: on ? '#fff' : 'var(--text-dim)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  transition: 'background 0.2s ease, color 0.2s ease',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <span>{t.label}</span>
                <span style={{ fontSize: 10, opacity: on ? 0.85 : 0.6 }}>{t.count}</span>
              </button>
            );
          })}
        </div>
      </div>

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
                <button onClick={() => setTypeFilter('all')} style={{ padding: '10px 20px', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '999px', cursor: 'pointer', fontSize: '12px', letterSpacing: '0.04em' }}>Show all</button>
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

      {selectedItem && (
        <Modal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

function AppShell() {
  const { feedbackOpen, feedbackSource, closeFeedback } = useApp();
  return (
    <>
      <MainApp />
      <FeedbackModal open={feedbackOpen} onClose={closeFeedback} source={feedbackSource} />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </ErrorBoundary>
  );
}
