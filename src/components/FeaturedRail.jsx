import React, { useRef, useState, useEffect } from 'react'
import { isPremium as isPremiumItem } from '../lib/promptHelpers.js'

/**
 * Awwwards-style horizontal "Design of the Day" rail.
 * Larger cards, snap-scrolled, with left/right chevrons.
 * Cards mount their hover video lazily on hover to keep the row lightweight.
 */
export default function FeaturedRail({ items, onOpen }) {
  const scrollerRef = useRef(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const update = () => {
      setCanLeft(el.scrollLeft > 8)
      setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 8)
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [items.length])

  if (!items || items.length === 0) return null

  const scrollBy = (dir) => {
    const el = scrollerRef.current
    if (!el) return
    const step = Math.max(320, Math.round(el.clientWidth * 0.75))
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  return (
    <section style={{ maxWidth: '1500px', margin: '0 auto', padding: '0 24px 40px', position: 'relative' }}>
      {/* Section heading */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px', padding: '0 4px' }}>
        <div>
          <div style={{ fontSize: '10.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--electric)', fontWeight: 700, marginBottom: '6px' }}>
            Design of the Day
          </div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 'clamp(28px, 3.4vw, 44px)', fontWeight: 400, margin: 0, letterSpacing: '-0.015em', color: 'var(--text)' }}>
            Signature picks
          </h2>
        </div>

        {/* Mobile-only swipe hint — visible below tablet since the
            chevron controls are hidden there. Touch users otherwise
            have no signal that the row scrolls sideways. */}
        <div className="cue-featured-swipe-hint" style={{
          display: 'none',
          alignItems: 'center', gap: 6,
          fontSize: 11, letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text-dim)',
          fontFamily: 'var(--font-sans)',
        }}>
          Swipe
          <span aria-hidden="true" style={{ display: 'inline-block' }}>
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </span>
        </div>

        {/* Chevron controls */}
        <div className="cue-featured-controls" style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => scrollBy(-1)}
            disabled={!canLeft}
            aria-label="Scroll left"
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: canLeft ? '#1c1c1e' : '#0e0e10',
              border: '1px solid var(--border)', color: canLeft ? 'var(--text)' : 'var(--text-dimmer)',
              cursor: canLeft ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <button
            onClick={() => scrollBy(1)}
            disabled={!canRight}
            aria-label="Scroll right"
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: canRight ? '#1c1c1e' : '#0e0e10',
              border: '1px solid var(--border)', color: canRight ? 'var(--text)' : 'var(--text-dimmer)',
              cursor: canRight ? 'pointer' : 'not-allowed',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
          </button>
        </div>
      </div>

      {/* Scroller — horizontal only. No data-lenis-prevent: Lenis needs to
          keep handling the page's vertical scroll when the cursor is over
          this row, otherwise vertical scrolling stutters/jitters. The
          chevron buttons drive horizontal navigation (wheel-to-scroll would
          conflict with Lenis anyway). */}
      <div
        ref={scrollerRef}
        className="cue-featured-scroller"
        style={{
          display: 'grid',
          gridAutoFlow: 'column',
          gridAutoColumns: 'min(520px, 78vw)',
          gap: '20px',
          overflowX: 'auto',
          overflowY: 'hidden',
          overscrollBehavior: 'contain',
          // `proximity` = feels smooth (soft magnet near a card),
          // vs `mandatory` which yanks after every scroll delta.
          scrollSnapType: 'x proximity',
          scrollPaddingLeft: '4px',
          paddingBottom: '6px',
          scrollBehavior: 'smooth',
        }}
      >
        {items.map((item) => (
          <FeaturedCard key={item.id} item={item} onOpen={onOpen} />
        ))}
      </div>

      {/* Hide the native scrollbar — chevrons drive navigation instead */}
      <style>{`
        .cue-featured-scroller { scrollbar-width: none; -ms-overflow-style: none; }
        .cue-featured-scroller::-webkit-scrollbar { display: none; width: 0; height: 0; }
      `}</style>
    </section>
  )
}

// ---------------------------------------------------------------------------
function FeaturedCard({ item, onOpen }) {
  const [hover, setHover] = useState(false)
  const [videoReady, setVideoReady] = useState(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const videoRef = useRef(null)
  const cardRef = useRef(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (hover) v.play().catch(() => {})
    else { v.pause(); v.currentTime = 0 }
  }, [hover])

  // Touch devices: no hover → auto-play whichever card is centered in
  // the viewport. Uses IntersectionObserver against the article itself.
  useEffect(() => {
    if (!cardRef.current || !item?.hoverSrc) return
    const noHover = typeof window !== 'undefined'
      && window.matchMedia && window.matchMedia('(hover: none)').matches
    if (!noHover) return
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => setHover(e.isIntersecting && e.intersectionRatio > 0.6))
    }, { threshold: [0, 0.6, 1] })
    io.observe(cardRef.current)
    return () => io.disconnect()
  }, [item?.hoverSrc])

  const isPaid = isPremiumItem(item)
  const primaryCategory = String(item.category || '').split(',')[0].trim()
  const media = item.hoverSrc
  const isImage = media && /\.(jpe?g|gif|png|webp|svg|heic)$/i.test(media)

  return (
    <article
      ref={cardRef}
      onClick={() => onOpen(item)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        scrollSnapAlign: 'start',
        background: hover ? '#212124' : 'var(--card-bg)',
        borderRadius: '18px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), background 0.25s ease',
        transform: hover ? 'translateY(-4px)' : 'translateY(0)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Media — larger 16/9 aspect for a hero-feel */}
      <div style={{ position: 'relative', aspectRatio: '16 / 9', background: 'var(--card-img-bg)', overflow: 'hidden', margin: '10px 10px 0', borderRadius: '12px' }}>
        <div style={{ position: 'absolute', inset: 0, borderRadius: '12px', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)', pointerEvents: 'none', zIndex: 4 }} />

        {/* Badges */}
        <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 3, display: 'flex', gap: '6px' }}>
          <span style={{
            padding: '5px 12px', borderRadius: '999px',
            fontFamily: 'var(--font-sans)', fontSize: '10.5px', fontWeight: 700,
            letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1,
            background: '#ccff00', color: '#000',
          }}>★ Featured</span>
          {isPaid && (
            <span style={{
              padding: '5px 12px', borderRadius: '999px',
              fontFamily: 'var(--font-sans)', fontSize: '10.5px', fontWeight: 700,
              letterSpacing: '0.1em', textTransform: 'uppercase', lineHeight: 1,
              background: 'var(--electric)', color: '#fff',
            }}>Cue+</span>
          )}
        </div>

        {/* Text fallback removed — every card has a thumbnail now. */}

        {item.thumbSrc && (
          <img
            src={item.thumbSrc}
            alt={item.title}
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'contain',
              background: '#000',
              transition: 'opacity 0.35s ease',
              opacity: (hover && !videoFailed) ? 0 : 1,
              zIndex: 1,
            }}
          />
        )}

        {media && isImage && (
          <img
            src={media}
            alt={item.title}
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.style.display = 'none' }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000', zIndex: 2 }}
          />
        )}

        {media && !isImage && !videoFailed && (
          <video
            ref={videoRef}
            src={media}
            poster={item.thumbSrc || undefined}
            loop muted playsInline
            preload="metadata"
            onError={() => setVideoFailed(true)}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'contain',
              transition: 'opacity 0.35s ease',
              opacity: (hover || !item.thumbSrc) ? 1 : 0,
              zIndex: 2,
            }}
          />
        )}
      </div>

      {/* Meta */}
      <div style={{ padding: '18px 20px 22px' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '19px', fontWeight: 500, lineHeight: 1.25, letterSpacing: '-0.01em', color: hover ? '#fff' : 'var(--text)', transition: 'color 0.2s ease', marginBottom: '6px' }}>
          {item.title}
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
          {primaryCategory || 'Featured'}
        </div>
      </div>
    </article>
  )
}
