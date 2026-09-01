import React, { useRef, useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import { isPremium as isPremiumItem } from '../lib/promptHelpers.js'
import { useVideoSlot } from '../lib/videoGovernor.js'
import { useAuth } from '../hooks/useAuth.jsx'

// Number of cards a signed-out visitor can browse before the rail
// swaps in a "sign in to see the rest" gate card. Anything higher
// gives the whole library away for free; anything lower feels
// stingy on a "signature category" pitch.
const PREVIEW_LIMIT = 4

/**
 * Category-specific horizontal rail. Modeled on FeaturedRail but
 * driven by a `title` prop and a filtered items array. Cards are
 * slightly smaller than the "Design of the Day" rail so the section
 * still reads as an accent, not a second hero.
 *
 * Wired into App.jsx between FeaturedRail and the main grid; only
 * renders if there are 3+ items in the given category (so a thin
 * bucket doesn't produce an awkward two-card row).
 */
export default function CategoryRail({ title, eyebrow, items, onOpen, onViewAll }) {
  const scrollerRef = useRef(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const { isSignedIn } = useUser()
  const { openAuth } = useAuth()

  // Gate: signed-out visitors browse the first N cards, then the
  // rail replaces the tail with a "sign in to see all X" CTA card.
  // Signed-in visitors see the full list.
  const showGate = !isSignedIn && items.length > PREVIEW_LIMIT
  const visibleItems = showGate ? items.slice(0, PREVIEW_LIMIT) : items
  const hiddenCount = showGate ? items.length - PREVIEW_LIMIT : 0

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

  if (!items || items.length < 3) return null

  const scrollBy = (dir) => {
    const el = scrollerRef.current
    if (!el) return
    const step = Math.max(280, Math.round(el.clientWidth * 0.7))
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  return (
    <section style={{ maxWidth: '1500px', margin: '0 auto', padding: '20px 24px 24px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '16px', padding: '0 4px' }}>
        <div>
          {eyebrow && (
            <div style={{ fontSize: '10.5px', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--electric)', fontWeight: 600, marginBottom: '4px' }}>
              {eyebrow}
            </div>
          )}
          <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: 'clamp(20px, 2.2vw, 26px)', fontWeight: 500, margin: 0, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            {title} <span style={{ color: 'var(--text-dim)', fontSize: '13px', fontWeight: 400, marginLeft: 6 }}>{items.length}</span>
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              style={{
                fontSize: 11.5, letterSpacing: '0.06em',
                color: 'var(--text-dim)', background: 'transparent',
                border: 'none', cursor: 'pointer', padding: '6px 8px',
                fontFamily: 'inherit',
              }}
            >
              See all →
            </button>
          )}
          <div className="cue-category-controls" style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => scrollBy(-1)}
              disabled={!canLeft}
              aria-label="Scroll left"
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: canLeft ? '#1c1c1e' : '#0e0e10',
                border: '1px solid var(--border)', color: canLeft ? 'var(--text)' : 'var(--text-dimmer)',
                cursor: canLeft ? 'pointer' : 'not-allowed',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <button
              onClick={() => scrollBy(1)}
              disabled={!canRight}
              aria-label="Scroll right"
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: canRight ? '#1c1c1e' : '#0e0e10',
                border: '1px solid var(--border)', color: canRight ? 'var(--text)' : 'var(--text-dimmer)',
                cursor: canRight ? 'pointer' : 'not-allowed',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6" /></svg>
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="cue-category-scroller"
        style={{
          display: 'grid',
          gridAutoFlow: 'column',
          gridAutoColumns: 'min(360px, 68vw)',
          gap: '16px',
          overflowX: 'auto',
          overflowY: 'hidden',
          overscrollBehavior: 'contain',
          scrollSnapType: 'x proximity',
          scrollPaddingLeft: '4px',
          paddingBottom: '4px',
          scrollBehavior: 'smooth',
        }}
      >
        {visibleItems.map((item) => (
          <CategoryCard key={item.id} item={item} onOpen={onOpen} />
        ))}
        {showGate && (
          <GateCard hiddenCount={hiddenCount} onOpenAuth={() => openAuth('sign-up')} />
        )}
      </div>

      <style>{`
        .cue-category-scroller { scrollbar-width: none; -ms-overflow-style: none; }
        .cue-category-scroller::-webkit-scrollbar { display: none; width: 0; height: 0; }
      `}</style>
    </section>
  )
}

// Sign-in gate — renders in the rail after PREVIEW_LIMIT cards for
// logged-out visitors. Same visual footprint as a CategoryCard so
// the horizontal rhythm doesn't break. Reads as a natural "next
// card" that happens to be a CTA.
function GateCard({ hiddenCount, onOpenAuth }) {
  return (
    <article
      onClick={onOpenAuth}
      style={{
        scrollSnapAlign: 'start',
        background: 'linear-gradient(180deg, rgba(0,0,255,0.10) 0%, rgba(0,0,255,0.02) 100%), #0e0e10',
        borderRadius: '14px',
        border: '1px dashed rgba(0,0,255,0.35)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 220ms ease, border-color 220ms ease',
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)'
        e.currentTarget.style.borderColor = 'rgba(0,0,255,0.6)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.borderColor = 'rgba(0,0,255,0.35)'
      }}
    >
      <div style={{
        position: 'relative', aspectRatio: '16 / 10',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 14,
        padding: '20px', textAlign: 'center',
      }}>
        <div style={{
          width: 48, height: 48, borderRadius: 999,
          background: 'rgba(0,0,255,0.15)',
          border: '1px solid rgba(0,0,255,0.35)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--electric)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </div>
        <div style={{
          fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em',
          color: 'var(--text)', lineHeight: 1.35,
        }}>
          {hiddenCount} more in this category
        </div>
      </div>
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '8px 14px', borderRadius: 999,
          background: 'var(--electric)', color: '#fff',
          fontSize: 12.5, fontWeight: 600,
          width: '100%', justifyContent: 'center', boxSizing: 'border-box',
        }}>
          Sign in to unlock →
        </div>
        <div style={{ marginTop: 6, fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'center', letterSpacing: '0.04em' }}>
          Free · one email to Alok, done in 15 sec
        </div>
      </div>
    </article>
  )
}

// Compact card — smaller than FeaturedCard, still hover-plays video
// via the same governor so global concurrency cap stays honored.
function CategoryCard({ item, onOpen }) {
  const [hover, setHover] = useState(false)
  const videoRef = useRef(null)
  const cardRef = useRef(null)
  const media = item.hoverSrc
  const isImage = media && /\.(jpe?g|gif|png|webp|svg|heic)$/i.test(media)
  const hoverIsVideo = media && !isImage
  const slot = useVideoSlot('category-rail', item.id, hoverIsVideo && hover)

  // Viewport autoplay (matches EditorialCard): flip `hover` true
  // when the card is meaningfully in view. Threshold is lower on
  // touch since horizontal-scroll rails rarely fill the viewport
  // to 40%, and higher-than-mobile on desktop to keep only the
  // handful of cards a user is actually looking at active.
  useEffect(() => {
    if (!cardRef.current || !hoverIsVideo) return
    const noHover = typeof window !== 'undefined'
      && window.matchMedia && window.matchMedia('(hover: none)').matches
    const threshold = noHover ? 0.15 : 0.4
    const io = new IntersectionObserver(([entry]) => {
      setHover(entry.isIntersecting && entry.intersectionRatio >= threshold)
    }, { threshold: [0, 0.15, 0.25, 0.4, 0.6, 1] })
    io.observe(cardRef.current)
    return () => io.disconnect()
  }, [hoverIsVideo])

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    if (hover) v.play().catch(() => {})
    else { v.pause(); v.currentTime = 0 }
  }, [hover])

  const isPaid = isPremiumItem(item)
  const primaryCategory = String(item.category || '').split(',')[0].trim()

  return (
    <article
      ref={cardRef}
      onClick={() => onOpen(item)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        scrollSnapAlign: 'start',
        background: hover ? '#1a1a1c' : 'var(--card-bg, #141416)',
        borderRadius: '14px',
        border: '1px solid var(--border)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1), background 220ms ease',
        transform: hover ? 'translateY(-2px)' : 'translateY(0)',
      }}
    >
      <div style={{ position: 'relative', aspectRatio: '16 / 10', overflow: 'hidden', background: '#0a0a0c' }}>
        {item.thumbSrc && (
          <img
            src={item.thumbSrc}
            alt={item.title}
            width={720}
            height={450}
            loading="lazy"
            decoding="async"
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover',
              opacity: hover && hoverIsVideo && slot.granted ? 0 : 1,
              transition: 'opacity 300ms ease',
            }}
          />
        )}
        {hoverIsVideo && hover && slot.granted && (
          <video
            ref={videoRef}
            src={media}
            poster={item.thumbSrc || undefined}
            loop muted playsInline preload="auto"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )}
        {isPaid && (
          <span style={{
            position: 'absolute', top: 10, left: 10, zIndex: 2,
            padding: '3px 8px', borderRadius: 999,
            background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.14)',
            color: 'var(--text)', fontSize: 9.5, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 500,
            backdropFilter: 'blur(6px)',
          }}>Premium</span>
        )}
      </div>

      <div style={{ padding: '12px 14px 14px' }}>
        <h3 style={{ margin: 0, fontSize: 13.5, fontWeight: 500, color: 'var(--text)', letterSpacing: '-0.005em', lineHeight: 1.3 }}>
          {item.title}
        </h3>
        {primaryCategory && (
          <div style={{ marginTop: 4, fontSize: 10.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
            {primaryCategory}
          </div>
        )}
      </div>
    </article>
  )
}
