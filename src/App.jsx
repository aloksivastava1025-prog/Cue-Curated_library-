import React, { useState, useEffect } from 'react';
import { SignInButton, UserButton, useUser } from '@clerk/clerk-react';
import Modal from './components/Modal.jsx';
import Admin from './pages/Admin.jsx';
import EditorialCard from './components/EditorialCard.jsx';
import { AppProvider, useApp } from './context/AppContext.jsx';
import './styles/overhaul.css';

function MainApp() {
  const [selectedItem, setSelectedItem] = useState(null);
  const [route, setRoute] = useState(window.location.hash);
  const { user, isSignedIn } = useUser();
  const isAdmin = isSignedIn && ['akashkumar7653099@gmail.com', 'aloksivastava1025@gmail.com'].includes(user?.primaryEmailAddress?.emailAddress);
  const { allPrompts } = useApp();

  useEffect(() => {
    const handleHash = () => setRoute(window.location.hash);
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  if (route === '#/admin' && isAdmin) {
    return <Admin />;
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', position: 'relative', fontFamily: 'var(--font-sans)', color: 'var(--text)' }}>
      {/* Sticky Nav */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 100, padding: '16px 24px', background: 'rgba(6,6,6,0.85)', backdropFilter: 'blur(20px)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
      <section style={{ padding: '100px 32px 60px', overflow: 'hidden', position: 'relative', textAlign: 'center' }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
        <div style={{ position: 'absolute', top: 0, bottom: 0, left: '50%', width: '1px', background: 'rgba(255,255,255,0.06)' }}></div>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: 'clamp(76px, 13vw, 200px)', fontStyle: 'italic', letterSpacing: '-0.035em', lineHeight: 0.9, color: 'var(--text)' }}>
            Collection<sup style={{ fontSize: 'clamp(16px, 3vw, 22px)', marginLeft: '8px', top: '-1.5em' }}>{allPrompts.length}</sup>
          </h1>
          <div style={{ marginTop: '24px', fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '26px', color: 'var(--text)' }}>
            New drop <span style={{ color: 'var(--electric)' }}>today</span>
          </div>
          <p style={{ margin: '40px auto 0', maxWidth: '520px', fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.55 }}>
            Battle-tested prompts for Bolt, v0, Cursor, and Framer. Stop endlessly tweaking and start shipping. Awwwards-tier interactions saved locally.
          </p>
        </div>
      </section>

      {/* Grid Section */}
      <section style={{ padding: '20px 20px 120px', maxWidth: '1600px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
        {allPrompts.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 20px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--text-dim)', marginBottom: '18px' }}>Empty library</div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '44px', fontStyle: 'italic', fontWeight: 400, color: 'var(--electric)', marginBottom: '18px' }}>Add your first resource</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-dim)', maxWidth: '520px', margin: '0 auto 32px' }}>Your library is empty. Head to the admin panel to add projects, screenshots, or videos.</p>
            {isAdmin && <a href="#/admin" style={{ display: 'inline-block', padding: '10px 20px', background: 'var(--electric)', color: '#fff', borderRadius: '3px', textDecoration: 'none', fontSize: '13px', fontWeight: 500, boxShadow: '0 6px 24px -8px rgba(0,0,255,0.6)' }}>Open admin &rarr;</a>}
          </div>
        ) : (
          allPrompts.map(item => (
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
