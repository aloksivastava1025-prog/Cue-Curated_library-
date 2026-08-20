import React, { useEffect, useRef, useState } from 'react'

/**
 * Compact tier filter dropdown — All / Free / Paid.
 * Symmetric to <TagFilter> so the filter bar reads as a balanced row.
 */
const OPTIONS = [
  { key: 'all',  label: 'All' },
  { key: 'free', label: 'Free' },
  { key: 'paid', label: 'Paid' },
]

export default function TierFilter({ value = 'all', counts = {}, onChange }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

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

  const current = OPTIONS.find((o) => o.key === value) || OPTIONS[0]
  const isFiltered = value !== 'all'

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', height: 34,
          background: isFiltered ? 'rgba(0,0,255,0.10)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isFiltered ? 'rgba(0,0,255,0.45)' : 'rgba(255,255,255,0.15)'}`,
          color: 'var(--text)', borderRadius: 999,
          fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
          letterSpacing: '0.05em', textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.32)' }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = isFiltered ? 'rgba(0,0,255,0.45)' : 'rgba(255,255,255,0.15)' }}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ opacity: 0.7 }}>
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <circle cx="7" cy="7" r="1.5" />
        </svg>
        <span style={{ color: 'var(--text-dim)', fontWeight: 500 }}>Price:</span>
        <span>{current.label}</span>
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease', opacity: 0.7 }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          data-lenis-prevent
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            minWidth: 160, maxWidth: 'calc(100vw - 16px)',
            background: '#0d0d10', border: '1px solid var(--border)', borderRadius: 12,
            boxShadow: '0 24px 60px rgba(0,0,0,0.7)', zIndex: 60,
            padding: 6,
          }}
        >
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 2 }}>
            {OPTIONS.map((o) => {
              const on = value === o.key
              return (
                <li key={o.key}>
                  <button
                    type="button"
                    onClick={() => { onChange(o.key); setOpen(false) }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 12px', borderRadius: 6,
                      background: on ? 'rgba(0,0,255,0.10)' : 'transparent',
                      border: 'none', color: 'var(--text)',
                      fontFamily: 'var(--font-sans)', fontSize: 13, cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                    onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{
                      width: 15, height: 15, borderRadius: 999,
                      border: `1.5px solid ${on ? 'var(--electric)' : 'var(--border)'}`,
                      background: on ? 'var(--electric)' : 'transparent',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {on && <span style={{ width: 6, height: 6, borderRadius: 999, background: '#fff' }} />}
                    </span>
                    <span style={{ flex: 1 }}>{o.label}</span>
                    {typeof counts[o.key] === 'number' && (
                      <span style={{ color: 'var(--text-dim)', fontSize: 10.5 }}>{counts[o.key]}</span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
