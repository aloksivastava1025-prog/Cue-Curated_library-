import React, { useState, useEffect } from 'react';
import { SignInButton, UserButton, useUser } from '@clerk/clerk-react';
import Lenis from 'lenis';
import Modal from './components/Modal.jsx';
import Admin from './pages/Admin.jsx';
import EditorialCard from './components/EditorialCard.jsx';
import { AppProvider, useApp } from './context/AppContext.jsx';
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
  const { user, isSignedIn } = useUser();
  const isAdmin = isSignedIn && ['akashkumar7653099@gmail.com', 'aloksivastava1025@gmail.com'].includes(user?.primaryEmailAddress?.emailAddress);
  const { allPrompts } = useApp();

  const visiblePrompts = typeFilter === 'all'
    ? allPrompts
    : allPrompts.filter((p) => {
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

  if (route === '#/admin' && isAdmin) {
    return <Admin />;
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', position: 'relative', fontFamily: 'var(--font-sans)', color: 'var(--text)' }}>
      {/* Sticky Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, padding: '16px 24px', background: '#060606', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transform: 'translateZ(0)', willChange: 'transform' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button style={{ background: '#1c1c1e', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '3px', color: 'var(--text)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)' }}>Menu</button>
          <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '24px', color: 'var(--text)' }}>CUE</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-dim)', fontSize: '12px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--electric)', boxShadow: '0 0 8px var(--electric)' }}></div>
            {allPrompts.length} resources
          </div>
          {isAdmin && (
            <a href="#/admin" style={{ fontSize: '12px', color: 'var(--text)', textDecoration: 'none' }}>Admin</a>
          )}
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
      <section style={{ padding: '100px 32px 60px', position: 'relative', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 'clamp(76px, 13vw, 200px)', fontStyle: 'italic', letterSpacing: '-0.035em', lineHeight: 0.9, color: 'var(--text)' }}>
            {headline}
          </h1>
          <div style={{ marginTop: '24px', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '26px', color: 'var(--text)' }}>
            New drop <span style={{ color: 'var(--electric)' }}>today</span>
          </div>
          <p style={{ margin: '40px auto 0', maxWidth: '520px', fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.55 }}>
            Battle-tested prompts for Bolt, v0, Cursor, and Framer. Stop endlessly tweaking and start shipping. Awwwards-tier interactions saved locally.
          </p>
        </div>
      </section>

      {/* Type filter toggle — All / Sections / Interactions */}
      <div style={{ maxWidth: '1500px', margin: '0 auto', padding: '8px 24px 4px', display: 'flex', justifyContent: 'center' }}>
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
      <section style={{ padding: '20px 24px 120px', maxWidth: '1500px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', columnGap: '24px', rowGap: '48px' }}>
        {visiblePrompts.length === 0 ? (
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

      {/* Footer */}
      <footer style={{ padding: '60px 24px', borderTop: '1px solid var(--border)', textAlign: 'center', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '14px', color: 'var(--text-dim)' }}>
        Cue Library &middot; Awwwards-tier interactions for Bolt &middot; v0 &middot; Cursor
      </footer>

      {selectedItem && (
        <Modal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
