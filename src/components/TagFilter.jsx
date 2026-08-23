import React, { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Tag filter — searchable checkbox list.
 * Normalizes tags (lowercased + trimmed) so admin capitalisation drift
 * doesn't produce duplicate options.
 * Selection is OR (union): an item matches if it carries ANY selected tag.
 */
// Raw lowercase + trim.
const rawNormalize = (t) => String(t || '').trim().toLowerCase()

// Canonicalize related tag variants so a single filter checkbox matches
// every item in that family. Without this, users tagged items 9 different
// ways for "3D/WebGL" (three-js, three.js, webgl, shader, 3d-tilt,
// 3d-transform, css-3d, ...) so clicking "webgl" only surfaced 2 of 15.
// Key = canonical display tag; value = list of variants that fold into it.
const TAG_ALIASES = {
  '3d & webgl': ['webgl', 'three-js', 'three.js', 'threejs', 'shader', 'glsl', '3d', '3d-tilt', '3d-transform', '3d-cylinder', '3d-stack', 'css-3d', 'three'],
  'scroll': ['scroll-driven', 'scroll-pin', 'scroll-reveal', 'scroll-interaction', 'scroll-animation', 'pinned-scroll'],
  'glass': ['glassmorphism', 'liquid-glass', 'frosted-glass'],
  'toggle': ['toggle', 'theme-toggle', 'dark-mode', 'light-dark-toggle', 'texture-toggle', 'card-toggle'],
  'card': ['card-stack', 'card-overlay'],
  'hover': ['hover-interaction', 'hover-reveal', 'hover-scale'],
  'reveal': ['blur-reveal', 'text-reveal', 'image-reveal'],
}

// Build a variant -> canonical lookup once.
const VARIANT_TO_CANONICAL = new Map()
for (const [canonical, variants] of Object.entries(TAG_ALIASES)) {
  for (const v of variants) VARIANT_TO_CANONICAL.set(v, canonical)
}

// Public normalize: fold aliases into canonical. Used everywhere a tag
// enters the filter machinery — TagFilter's counting, App.jsx's match
// logic, and the "selected chips" UI.
export const normalizeTag = (t) => {
  const raw = rawNormalize(t)
  return VARIANT_TO_CANONICAL.get(raw) || raw
}

// Full expansion — given a canonical tag, return every raw variant so
// App.jsx's filter can match items whose raw stored tag differs.
export const expandTag = (canonical) => {
  const c = rawNormalize(canonical)
  const variants = TAG_ALIASES[c]
  return variants ? [c, ...variants] : [c]
}

export default function TagFilter({ items = [], selected = [], onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)
  const rootRef = useRef(null)

  // Rank tags by frequency across the library so useful ones are top.
  const tagOptions = useMemo(() => {
    const counts = new Map()
    items.forEach((it) => {
      ;(it.tags || []).forEach((raw) => {
        const t = normalizeTag(raw)
        if (!t) return
        counts.set(t, (counts.get(t) || 0) + 1)
      })
    })
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([tag, count]) => ({ tag, count }))
  }, [items])

  // Curated default view — hide the long tail of one-off tags that every
  // new component drops into the library, otherwise the list explodes.
  // Singletons stay searchable (typing surfaces them) and toggle-able via
  // "Show all". Also cap the default-visible ceiling so 20 tags with
  // count=1 don't push down the useful ones.
  const MIN_COUNT_DEFAULT = 2
  const MAX_DEFAULT_VISIBLE = 20
  const hiddenCount = tagOptions.filter((o) => o.count < MIN_COUNT_DEFAULT).length
    + Math.max(0, tagOptions.filter((o) => o.count >= MIN_COUNT_DEFAULT).length - MAX_DEFAULT_VISIBLE)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    // While searching, show every match regardless of count — user is
    // asking for something specific, so completeness matters.
    if (q) return tagOptions.filter(({ tag }) => tag.includes(q))
    // Also show the full list when the user has already picked a rare
    // tag (so they can un-pick it) or clicked "Show all".
    if (showAll) return tagOptions
    const selectedSet = new Set(selected)
    return tagOptions.filter(({ tag, count }, i) => {
      if (selectedSet.has(tag)) return true
      if (count < MIN_COUNT_DEFAULT) return false
      return i < MAX_DEFAULT_VISIBLE
    })
  }, [tagOptions, query, showAll, selected])

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

  const isSelected = (t) => selected.includes(t)
  const toggle = (t) => {
    if (isSelected(t)) onChange(selected.filter((x) => x !== t))
    else onChange([...selected, t])
  }
  const clear = () => onChange([])

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setQuery('') }}
        aria-expanded={open}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', height: 34,
          background: selected.length ? 'rgba(0,0,255,0.08)' : 'transparent',
          border: `1px solid ${selected.length ? 'rgba(0,0,255,0.35)' : 'var(--border)'}`,
          color: 'var(--text)', borderRadius: 999,
          fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
          letterSpacing: '0.05em', textTransform: 'uppercase',
          cursor: 'pointer',
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
      >
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
          <circle cx="7" cy="7" r="1" />
        </svg>
        <span>Tags</span>
        {selected.length > 0 && (
          <span style={{
            minWidth: 18, height: 18, padding: '0 6px', borderRadius: 999,
            background: 'var(--electric)', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>{selected.length}</span>
        )}
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease', opacity: 0.7 }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          data-lenis-prevent
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0,
            width: 'min(320px, calc(100vw - 24px))', maxHeight: 'min(420px, 70vh)',
            background: '#0d0d10', border: '1px solid var(--border)', borderRadius: 12,
            boxShadow: '0 24px 60px rgba(0,0,0,0.7)', zIndex: 60,
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Search */}
          <div style={{ padding: 10, borderBottom: '1px solid var(--border)' }}>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${tagOptions.length} tags…`}
              style={{
                width: '100%', padding: '8px 10px',
                background: '#0b0b0d', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 6,
                fontFamily: 'var(--font-sans)', fontSize: 12.5, outline: 'none',
              }}
            />
          </div>

          {/* Checkbox list */}
          <div style={{ overflowY: 'auto', flex: 1, padding: 6 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 12.5 }}>
                {query ? `No tags match "${query}".` : 'No tags yet.'}
              </div>
            ) : filtered.map(({ tag, count }) => {
              const on = isSelected(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggle(tag)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 10px', borderRadius: 6,
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
                    width: 15, height: 15, borderRadius: 3,
                    background: on ? 'var(--electric)' : 'transparent',
                    border: `1.5px solid ${on ? 'var(--electric)' : 'var(--border)'}`,
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {on && (
                      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 6L9 17l-5-5" />
                      </svg>
                    )}
                  </span>
                  <span style={{ flex: 1 }}>{tag}</span>
                  <span style={{ color: 'var(--text-dim)', fontSize: 10.5 }}>{count}</span>
                </button>
              )
            })}
            {!query && !showAll && hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                style={{
                  width: '100%', padding: '10px', marginTop: 4,
                  background: 'transparent', border: '1px dashed var(--border)',
                  borderRadius: 6, color: 'var(--text-dim)',
                  fontFamily: 'var(--font-sans)', fontSize: 11.5, cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
              >Show all tags ({hiddenCount} more)</button>
            )}
            {!query && showAll && (
              <button
                type="button"
                onClick={() => setShowAll(false)}
                style={{
                  width: '100%', padding: '10px', marginTop: 4,
                  background: 'transparent', border: '1px dashed var(--border)',
                  borderRadius: 6, color: 'var(--text-dim)',
                  fontFamily: 'var(--font-sans)', fontSize: 11.5, cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
              >Show only popular tags</button>
            )}
          </div>

          {selected.length > 0 && (
            <div style={{ padding: 10, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                {selected.length} selected
              </span>
              <button
                type="button"
                onClick={clear}
                style={{
                  padding: '5px 10px', borderRadius: 999,
                  background: 'transparent', border: '1px solid var(--border)',
                  color: 'var(--text)', fontSize: 11, cursor: 'pointer', letterSpacing: '0.02em',
                }}
              >Clear all</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
