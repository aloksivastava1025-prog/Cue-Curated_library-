import React from 'react'
import Footer from '../components/Footer.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'

export default function NotFound() {
  usePageMeta({ title: 'Not found', description: 'The page you are looking for does not exist.' })
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
        <a href="/" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 22, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.01em' }}>Cue<span style={{ color: 'var(--electric)' }}>.</span></a>
      </nav>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 520 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--electric)', fontWeight: 700, marginBottom: 16 }}>
            404
          </div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontStyle: 'italic', fontSize: 'clamp(48px, 8vw, 80px)', letterSpacing: '-0.03em', margin: 0, lineHeight: 1 }}>
            Lost in the library.
          </h1>
          <p style={{ margin: '24px auto 32px', fontSize: 14.5, lineHeight: 1.6, color: 'var(--text-dim)' }}>
            The page you're looking for doesn't exist — or it moved. Head back and browse the collection.
          </p>
          <a href="/" style={{ display: 'inline-block', padding: '12px 22px', background: 'var(--electric)', color: '#fff', textDecoration: 'none', borderRadius: 999, fontSize: 13, fontWeight: 600 }}>
            Back to library →
          </a>
        </div>
      </main>
      <Footer />
    </div>
  )
}
