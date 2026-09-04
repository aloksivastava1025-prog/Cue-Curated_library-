import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import WhatsAppButton from './WhatsAppButton.jsx'

/**
 * Compact single-row footer. Kept minimal so it feels like a final line
 * of the page rather than another content block.
 */
export default function Footer({ onSuggest }) {
  const { openFeedback } = useApp()
  const year = new Date().getFullYear()
  const suggestHandler = onSuggest || (() => openFeedback('footer'))

  const links = [
    { label: 'Pricing',  href: '#/pricing' },
    { label: 'Hire me',  onClick: () => window.dispatchEvent(new CustomEvent('cue:openHire')), accent: true },
    { label: 'Privacy',  href: '#/legal/privacy' },
    { label: 'Terms',    href: '#/legal/terms' },
    { label: 'Refund',   href: '#/legal/refund' },
    { label: 'License',  href: '#/legal/license' },
    { label: 'Contact',  href: '#/contact' },
    { label: 'Suggest',  onClick: suggestHandler },
  ]

  return (
    <footer style={{
      borderTop: '1px solid var(--border)',
      background: '#060606',
      color: 'var(--text-dim)',
      fontFamily: 'var(--font-sans)',
      padding: '20px 24px',
    }}>
      <div className="cue-footer-row" style={{
        maxWidth: 1400, margin: '0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 16, color: 'var(--text)', letterSpacing: '-0.01em' }}>Cue<span style={{ color: 'var(--electric)' }}>.</span></span>
          <span style={{ fontSize: 11.5, letterSpacing: '0.02em' }}>© {year} · Copy · paste · ship.</span>
          <a
            href="https://x.com/Alok619308"
            target="_blank" rel="noopener noreferrer"
            aria-label="Cue on X (Twitter)"
            style={socialIconStyle}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-dim)' }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z"/>
            </svg>
          </a>
          <WhatsAppButton variant="inline" />
        </div>

        <nav style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {links.map((l, i) => {
            const style = l.accent
              ? { ...(l.onClick ? btnStyle : linkStyle), color: 'var(--electric, #0000ff)', fontWeight: 600 }
              : (l.onClick ? btnStyle : linkStyle)
            return l.onClick ? (
              <button key={i} type="button" onClick={l.onClick} style={style}>{l.label}</button>
            ) : (
              <a key={i} href={l.href} style={style}>{l.label}</a>
            )
          })}
        </nav>
      </div>
    </footer>
  )
}
const socialIconStyle = {
  marginLeft: 4,
  color: 'var(--text-dim)',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 22, height: 22, borderRadius: 999,
  transition: 'color 0.15s ease',
}

const linkStyle = {
  color: 'var(--text-dim)',
  textDecoration: 'none',
  fontSize: 11.5,
  letterSpacing: '0.02em',
  transition: 'color 0.15s ease',
}
const btnStyle = {
  ...linkStyle,
  background: 'transparent',
  border: 'none',
  padding: 0,
  fontFamily: 'var(--font-sans)',
  cursor: 'pointer',
}
