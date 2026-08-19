import React, { useState } from 'react'
import { useUser, UserButton } from '@clerk/clerk-react'
import { useAuth } from '../hooks/useAuth.jsx'
import { useApp } from '../context/AppContext.jsx'
import EditorialCard from '../components/EditorialCard.jsx'
import Modal from '../components/Modal.jsx'
import Footer from '../components/Footer.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'

/**
 * "My Saved" — signed-in users see items they've bookmarked.
 * Signed-out users see a soft sign-in prompt (no content leaked).
 */
export default function Saved() {
  usePageMeta({ title: 'Your saved items', description: 'Items you bookmarked from the CUE library.' })
  const { user, isSignedIn } = useUser()
  const { openAuth } = useAuth()
  const { allPrompts, bookmarkedIds } = useApp()
  const [selectedItem, setSelectedItem] = useState(null)

  const saved = allPrompts.filter((p) => bookmarkedIds?.has(p.id))

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
      {/* Nav */}
      <nav className="cue-nav" style={{
        position: 'sticky', top: 0, zIndex: 100, padding: '16px 24px',
        background: '#060606', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <a href="#/" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 24, color: 'var(--text)' }}>CUE</span>
        </a>
        <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>My Saved</span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="#/" style={{ fontSize: 12, color: 'var(--text-dim)', textDecoration: 'none' }}>← Library</a>
          {!isSignedIn ? (
            <button
              onClick={() => openAuth('sign-in')}
              style={{ background: 'var(--electric)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 3, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
            >Sign in</button>
          ) : (
            <UserButton>
              <UserButton.MenuItems>
                <UserButton.Link
                  label="Billing & invoices"
                  labelIcon={<span style={{ display: 'inline-block', width: 16, height: 16 }}>▤</span>}
                  href="/#/billing"
                />
              </UserButton.MenuItems>
            </UserButton>
          )}
        </div>
      </nav>

      {/* Hero */}
      <section style={{ padding: '80px 24px 40px', textAlign: 'center' }}>
        <div style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--electric)', fontWeight: 700, marginBottom: 12 }}>
          Your library
        </div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontStyle: 'italic', fontSize: 'clamp(48px, 9vw, 96px)', letterSpacing: '-0.03em', margin: 0, lineHeight: 0.95 }}>
          Saved
        </h1>
        {isSignedIn && (
          <p style={{ margin: '20px auto 0', maxWidth: 520, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>
            {saved.length === 0
              ? 'No saves yet. Bookmark items you want to come back to — they land here.'
              : `${saved.length} ${saved.length === 1 ? 'item' : 'items'} saved for later.`}
          </p>
        )}
      </section>

      {/* Content */}
      {!isSignedIn ? (
        <div style={{ padding: '40px 24px 120px', maxWidth: 480, margin: '0 auto', textAlign: 'center' }}>
          <p style={{ fontSize: 14.5, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 24 }}>
            Sign in to save items to your library. It's free — bookmark anything you like, come back for it later.
          </p>
          <button
            onClick={() => openAuth('sign-in')}
            style={{ padding: '12px 24px', background: 'var(--electric)', color: '#fff', border: 'none', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
          >Sign in to CUE</button>
        </div>
      ) : saved.length === 0 ? (
        <div style={{ padding: '20px 24px 120px', textAlign: 'center' }}>
          <a href="#/" style={{ display: 'inline-block', marginTop: 20, padding: '12px 24px', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 999, fontSize: 13, textDecoration: 'none' }}>
            Browse the library →
          </a>
        </div>
      ) : (
        <section style={{
          padding: '20px 24px 120px', maxWidth: 1500, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          columnGap: 24, rowGap: 48,
        }}>
          {saved.map((item) => (
            <EditorialCard key={item.id} item={item} setSelectedItem={setSelectedItem} />
          ))}
        </section>
      )}

      <Footer />

      {selectedItem && <Modal item={selectedItem} onClose={() => setSelectedItem(null)} />}
    </div>
  )
}
