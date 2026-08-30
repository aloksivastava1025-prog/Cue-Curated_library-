import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useApp } from '../context/AppContext.jsx'

/**
 * First-visit welcome modal. Framer-style: dark card, top mosaic of
 * real component thumbnails (shows the *breadth* of the library at a
 * glance), single blue CTA at the bottom.
 *
 * Behaviour:
 *   - Fires 3s after page paint so the grid renders first — value
 *     precedes greeting.
 *   - One-shot per browser via localStorage.
 *   - CTA switches the grid to the free-tier filter and dismisses.
 *   - Backdrop click / × / Esc dismisses.
 *   - Mosaic pulls 6 items with thumbnails; prefers admin-starred
 *     featured picks and falls back to the newest-with-thumb items
 *     if the featured pool is thin.
 */

const STORAGE_KEY = 'cue.welcomed.v2'
const SESSION_KEY = 'cue.welcomed.session'
const APPEAR_DELAY_MS = 3000

export default function WelcomeCard({ onExploreFree, onSuggest }) {
  const { allPrompts } = useApp()
  const { isSignedIn } = useUser()
  const [visible, setVisible] = useState(false)
  const [dismissing, setDismissing] = useState(false)
  // Live-ticking 24h coupon window countdown. Reads the same start
  // timestamp the hero pill and the CouponTimer component use so
  // everything shows the same number to the second.
  const [timeLeft, setTimeLeft] = useState(() => readTimeLeft())
  useEffect(() => {
    const id = setInterval(() => setTimeLeft(readTimeLeft()), 1000)
    return () => clearInterval(id)
  }, [])
  // IDs of tiles whose image URL failed to load — hidden from render
  // so a stale/404 thumbnail doesn't leave a black square in the mosaic.
  const [brokenIds, setBrokenIds] = useState(() => new Set())

  // Ordered pool: featured first, then newest with thumb. We render 6
  // and hold the rest as backup — when a tile 404s we drop the failed
  // id into brokenIds and the next backup slot takes over automatically.
  //
  // Last slot is reserved for the strongest visual in the library — the
  // WebGL Fisheye Chromatic Card Grid — so the mosaic always closes
  // with a wow moment. If that specific item isn't published or has
  // no thumb, the last slot silently falls back to pool order.
  //
  // MOSAIC_BLACKLIST — items whose thumbnails are technically valid but
  // read as "empty black square" inside the 96x72px mosaic tiles
  // (dark-on-dark designs). Excluded from the welcome pool only; they
  // still appear normally in the main grid.
  const HERO_PICK_ID = 'cue059'
  const MOSAIC_BLACKLIST = new Set([
    'cue058', // Rosette-to-Receipt — near-black expanded state
    'cue057', // Isometric Wave-Grid Loader — dark-mode default
    'cue014', // Coming Soon placeholder
  ])
  const pool = useMemo(() => {
    const withThumb = (allPrompts || []).filter(
      (p) => p.thumbSrc && !MOSAIC_BLACKLIST.has(p.id)
    )
    const featured = withThumb.filter((p) => p.rail === 'featured')
    const rest = withThumb.filter((p) => p.rail !== 'featured')
    return [...featured, ...rest]
  }, [allPrompts])

  const tiles = useMemo(() => {
    const clean = pool.filter((p) => !brokenIds.has(p.id))
    const hero = clean.find((p) => p.id === HERO_PICK_ID)
    // Take the top 5 tiles (excluding the hero if it happens to be
    // in the front) and append the hero last. This guarantees the
    // strongest visual anchors the bottom-right of the mosaic.
    const front = clean.filter((p) => p.id !== HERO_PICK_ID).slice(0, hero ? 5 : 6)
    return hero ? [...front, hero] : front
  }, [pool, brokenIds])

  useEffect(() => {
    // Signed-in users see the welcome card at most once ever (localStorage).
    // Signed-out visitors see it at most once per browser SESSION —
    // sessionStorage clears when the tab closes, so a same-tab refresh
    // won't re-nag them, but a fresh visit tomorrow will still catch
    // returning anon users with a first-impression hit.
    // Coupon hunt banner — show once, then wait ~3 hours before
    // showing again on a return visit. Prevents nagging on refresh
    // while still catching visitors who come back later in the day.
    let couponUnlocked = false
    try { couponUnlocked = !!localStorage.getItem('cue.coupon.unlocked') } catch {}
    if (couponUnlocked) return
    const REVISIT_QUIET_MS = 3 * 60 * 60 * 1000 // 3 hours
    let lastShownAt = 0
    try { lastShownAt = parseInt(localStorage.getItem('cue.welcome.shown_at') || '0', 10) || 0 } catch {}
    if (lastShownAt && Date.now() - lastShownAt < REVISIT_QUIET_MS) return
    // Only fire once we have real thumbnails to render — otherwise the
    // mosaic would boot as six empty dark tiles, which was the "small
    // Text-only card" the user reported on first tests.
    if (tiles.length < 3) return
    const t = setTimeout(() => setVisible(true), APPEAR_DELAY_MS)
    return () => clearTimeout(t)
  }, [tiles.length, isSignedIn])

  useEffect(() => {
    if (!visible) return
    const onKey = (e) => { if (e.key === 'Escape') dismiss() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible])

  const markSeen = () => {
    // Session flag for anon (refresh-safe), persistent flag for signed-in.
    try { sessionStorage.setItem(SESSION_KEY, '1') } catch {}
    try { localStorage.setItem(STORAGE_KEY, '1') } catch {}
    // Timestamp so the 3-hour revisit-quiet window on the coupon
    // banner has something to check against.
    try { localStorage.setItem('cue.welcome.shown_at', String(Date.now())) } catch {}
  }

  const dismiss = () => {
    setDismissing(true)
    setTimeout(() => { setVisible(false); markSeen() }, 220)
  }

  const onPrimary = () => {
    markSeen()
    if (onExploreFree) onExploreFree()
    dismiss()
  }

  if (!visible) return null

  return (
    <>
      <style>{`
        @keyframes cue-welcome-back-in { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cue-welcome-in {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)   scale(1); }
        }
        @keyframes cue-welcome-out {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(12px) scale(0.97); }
        }
        .cue-welcome-backdrop {
          position: fixed; inset: 0; z-index: 1000;
          background: rgba(0,0,0,0.55);
          backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          animation: cue-welcome-back-in 220ms ease-out;
        }
        .cue-welcome-panel {
          width: 100%; max-width: 380px;
          /* Metallic finish — subtle top-highlight → mid-tone body →
             bottom-shadow gradient layered under a hairline gradient
             border. Reads like a brushed chrome slab, not a flat card. */
          background:
            linear-gradient(180deg, rgba(255,255,255,0.05) 0%, transparent 12%),
            linear-gradient(180deg, #1a1a1d 0%, #0e0e10 55%, #0a0a0c 100%);
          border-radius: 20px;
          overflow: hidden;
          box-shadow:
            0 60px 120px rgba(0,0,0,0.7),
            0 20px 40px rgba(0,0,0,0.4),
            inset 0 1px 0 rgba(255,255,255,0.12),
            inset 0 -1px 0 rgba(0,0,0,0.5);
          position: relative;
          animation: cue-welcome-in 460ms cubic-bezier(0.22, 1, 0.36, 1);
          font-family: var(--font-sans);
        }
        /* Metallic bezel — thin gradient stroke that shimmers top-to-bottom. */
        .cue-welcome-panel::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: 20px; padding: 1px;
          background: linear-gradient(180deg,
            rgba(255,255,255,0.35) 0%,
            rgba(255,255,255,0.06) 30%,
            rgba(255,255,255,0.02) 70%,
            rgba(255,255,255,0.12) 100%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
                  mask-composite: exclude;
          pointer-events: none;
        }
        .cue-welcome-panel.cue-welcome-out {
          animation: cue-welcome-out 220ms ease-in forwards;
        }
        .cue-welcome-close {
          position: absolute; top: 12px; right: 12px; z-index: 2;
          width: 28px; height: 28px; border-radius: 999px;
          background: rgba(0,0,0,0.5); color: rgba(255,255,255,0.7);
          border: 1px solid rgba(255,255,255,0.1); cursor: pointer;
          font-size: 16px; line-height: 1;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .cue-welcome-close:hover { color: #fff; background: rgba(0,0,0,0.7); }
        .cue-welcome-mosaic {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 5px;
          padding: 12px 12px 6px 12px;
          background: #0e0e10;
        }
        .cue-welcome-tile {
          position: relative;
          aspect-ratio: 4 / 3;
          border-radius: 10px;
          overflow: hidden;
          background: #1a1a1c;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.03);
        }
        .cue-welcome-tile::after {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(180deg, transparent 60%, rgba(0,0,0,0.35) 100%);
          pointer-events: none;
        }
        .cue-welcome-tile img {
          width: 100%; height: 100%; object-fit: cover; display: block;
        }
        .cue-welcome-body {
          padding: 16px 20px 18px;
          text-align: left;
        }
        .cue-welcome-title {
          font-family: var(--font-sans);
          color: #fff; font-size: 17px; font-weight: 600;
          letter-spacing: -0.015em; line-height: 1.25;
          margin: 0 0 6px 0;
        }
        .cue-welcome-title .dot { color: var(--electric); }
        .cue-welcome-sub {
          color: rgba(255,255,255,0.62);
          font-size: 12.5px; line-height: 1.5;
          margin: 0 0 14px 0; max-width: 340px;
        }
        .cue-welcome-timer {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 8px 12px;
          border-radius: 999px;
          background: rgba(204,255,0,0.08);
          border: 1px solid rgba(204,255,0,0.30);
          font-family: 'SF Mono', ui-monospace, Menlo, monospace;
          font-size: 12px; font-weight: 600;
          color: #ccff00;
          letter-spacing: 0.04em;
          margin-bottom: 14px;
        }
        .cue-welcome-timer-dot {
          width: 6px; height: 6px; border-radius: 999px;
          background: #ccff00;
          animation: cue-welcome-timer-pulse 1.4s ease-in-out infinite;
        }
        @keyframes cue-welcome-timer-pulse {
          0%, 100% { opacity: 0.35; }
          50%      { opacity: 1; }
        }
        .cue-welcome-cta {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 11px 22px; border-radius: 8px;
          background: var(--electric); color: #fff;
          border: none; cursor: pointer;
          font-family: var(--font-sans); font-size: 13.5px; font-weight: 500;
          transition: transform 180ms ease, filter 180ms ease;
        }
        .cue-welcome-cta:hover { transform: translateY(-1px); filter: brightness(1.1); }
        .cue-welcome-actions {
          display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
        }
        .cue-welcome-secondary {
          background: transparent; border: none;
          color: rgba(255,255,255,0.55);
          font-family: var(--font-sans); font-size: 12.5px; font-weight: 500;
          cursor: pointer; padding: 0; letter-spacing: 0.01em;
          transition: color 180ms ease;
        }
        .cue-welcome-secondary:hover { color: #fff; }
        .cue-welcome-skip {
          margin-left: auto;
          background: transparent;
          border: 1px solid rgba(255,255,255,0.14);
          color: rgba(255,255,255,0.55);
          font-family: var(--font-sans); font-size: 12.5px; font-weight: 500;
          cursor: pointer;
          padding: 8px 16px; border-radius: 999px;
          transition: color 180ms ease, border-color 180ms ease, background 180ms ease;
        }
        .cue-welcome-skip:hover {
          color: #fff;
          border-color: rgba(255,255,255,0.28);
          background: rgba(255,255,255,0.04);
        }
        @media (max-width: 480px) {
          .cue-welcome-panel { max-width: 100%; }
          .cue-welcome-body { padding: 18px 20px 20px; }
          .cue-welcome-title { font-size: 18px; }
        }
      `}</style>

      <div
        className={`cue-welcome-backdrop`}
        onClick={dismiss}
        role="dialog" aria-label="Welcome to Cue"
      >
        <div
          className={`cue-welcome-panel${dismissing ? ' cue-welcome-out' : ''}`}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="cue-welcome-close" onClick={dismiss} aria-label="Dismiss welcome">×</button>

          {/* MOSAIC — real component thumbnails as the pitch. onError
              on each <img> flags that item as broken so the next backup
              from the pool slides in — no black tile ever renders. */}
          <div className="cue-welcome-mosaic" aria-hidden="true">
            {tiles.map((t) => (
              <div key={t.id} className="cue-welcome-tile">
                <img
                  src={t.thumbSrc}
                  alt=""
                  loading="eager"
                  fetchpriority="high"
                  decoding="async"
                  onError={() => {
                    setBrokenIds((prev) => {
                      const next = new Set(prev)
                      next.add(t.id)
                      return next
                    })
                  }}
                />
              </div>
            ))}
          </div>

          {/* BODY */}
          <div className="cue-welcome-body">
            <h3 className="cue-welcome-title">
              Welcome to Cue<span className="dot">.</span>
            </h3>
            <p className="cue-welcome-sub">
              A curated library of Awwwards-tier UI components. Every card ships with the copy-paste prompt for Cursor / v0 / Bolt, plus React source for the ones that need it.
              <br /><br />
              Browse the collection, hover any card to preview the motion, and grab whatever fits your build.
            </p>
            <div className="cue-welcome-actions">
              <button className="cue-welcome-cta" onClick={onPrimary}>
                Begin the hunt
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
              </button>
              <button
                className="cue-welcome-secondary"
                onClick={() => {
                  markSeen()
                  if (onSuggest) onSuggest()
                  dismiss()
                }}
              >
                Suggest anything →
              </button>
              <button
                className="cue-welcome-skip"
                onClick={dismiss}
                aria-label="Skip"
              >
                Skip
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

const COUPON_WINDOW_MS = 24 * 60 * 60 * 1000

function readTimeLeft() {
  try {
    let start = parseInt(localStorage.getItem('cue.coupon.window.start') || '0', 10) || 0
    if (!start) {
      start = Date.now()
      localStorage.setItem('cue.coupon.window.start', String(start))
    }
    return Math.max(0, start + COUPON_WINDOW_MS - Date.now())
  } catch {
    return COUPON_WINDOW_MS
  }
}

function formatTimeLeft(ms) {
  if (ms <= 0) return '00:00:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)} left`
}
