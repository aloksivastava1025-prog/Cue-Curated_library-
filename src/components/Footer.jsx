import React from 'react'
import { useApp } from '../context/AppContext.jsx'

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
    { label: 'Privacy',  href: '#/legal/privacy' },
    { label: 'Terms',    href: '#/legal/terms' },
    { label: 'Refund',   href: '#/legal/refund' },
    { label: 'License',  href: '#/legal/license' },
    { label: 'Contact',  href: 'mailto:hello@cuedesign.space' },
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
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 16, color: 'var(--text)' }}>CUE</span>
          <span style={{ fontSize: 11.5, letterSpacing: '0.02em' }}>© {year} · Copy · paste · ship.</span>
        </div>

        <nav style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
          {links.map((l, i) => l.onClick ? (
            <button
              key={i} type="button" onClick={l.onClick}
              style={btnStyle}
            >{l.label}</button>
          ) : (
            <a key={i} href={l.href} style={linkStyle}>{l.label}</a>
          ))}
        </nav>
      </div>
    </footer>
  )
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
