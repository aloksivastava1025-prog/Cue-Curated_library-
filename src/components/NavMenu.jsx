import React, { useEffect, useRef, useState } from 'react'

/**
 * Compact 3-dot nav menu — consolidates Saved / Suggest / Admin so the
 * top-right of the nav stays uncluttered.
 *
 * Items are provided by the parent. Each item:
 *   { label, href?, onClick?, badge?, muted?, hidden? }
 * hidden items are simply skipped (nice for the isAdmin-only Admin entry).
 */
export default function NavMenu({ items = [], label = 'Menu' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  const visible = items.filter((i) => !i.hidden)
  const totalBadge = visible.reduce((n, i) => n + (Number(i.badge) || 0), 0)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!visible.length) return null

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={label}
        aria-expanded={open}
        style={{
          background: 'transparent', border: '1px solid var(--border)',
          color: 'var(--text)',
          height: 30, borderRadius: 999,
          padding: '0 12px 0 14px',
          cursor: 'pointer', position: 'relative',
          display: 'inline-flex', alignItems: 'center', gap: 8,
          fontFamily: 'var(--font-sans)',
          fontSize: 12, letterSpacing: '0.02em', fontWeight: 500,
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'transparent' }}
      >
        <span>{label}</span>
        {totalBadge > 0 && (
          <span style={{
            minWidth: 16, height: 16, padding: '0 5px', borderRadius: 999,
            background: 'var(--electric)', color: '#fff',
            fontSize: 9.5, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>{totalBadge}</span>
        )}
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0,
          minWidth: 200, maxWidth: 'calc(100vw - 16px)',
          background: '#0d0d10', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 24px 60px rgba(0,0,0,0.7)', zIndex: 200,
          padding: 6,
        }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 2 }}>
            {visible.map((item, i) => {
              const inner = (
                <>
                  {item.icon && (
                    <span style={{ display: 'inline-flex', width: 16, alignItems: 'center', justifyContent: 'center' }}>{item.icon}</span>
                  )}
                  <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                  {item.badge > 0 && (
                    <span style={{
                      minWidth: 18, height: 18, padding: '0 6px', borderRadius: 999,
                      background: 'rgba(0,0,255,0.16)', border: '1px solid rgba(0,0,255,0.36)',
                      fontSize: 10, fontWeight: 700, color: 'var(--text)',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    }}>{item.badge}</span>
                  )}
                </>
              )
              const base = {
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px', borderRadius: 6,
                color: item.muted ? 'var(--text-dim)' : 'var(--text)',
                fontSize: 13, letterSpacing: '0.01em',
                textDecoration: 'none', cursor: 'pointer',
                background: 'transparent', border: 'none',
                width: '100%', fontFamily: 'var(--font-sans)',
                transition: 'background 0.12s ease',
              }
              return (
                <li key={i}>
                  {item.onClick ? (
                    <button
                      type="button"
                      onClick={() => { setOpen(false); item.onClick() }}
                      style={base}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >{inner}</button>
                  ) : (
                    <a
                      href={item.href}
                      onClick={() => setOpen(false)}
                      style={base}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
                    >{inner}</a>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
