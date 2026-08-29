import React, { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext.jsx'

/**
 * FounderDock — a small persistent floating avatar of the founder
 * bottom-right. On hover (or tap on touch) it expands to reveal
 * two direct-contact CTAs: X (Twitter) DM and email.
 *
 * Design goals:
 *   - Signals "there's a real human behind this product" — the
 *     Awwwards / Aceternity move that converts on-the-fence users.
 *   - Non-intrusive: never blocks content, just a 44x44 pill in the
 *     corner that expands on hover.
 *   - Works on touch: tap toggles the expanded state.
 *
 * Config lives at the top of the file — swap TWITTER_URL / EMAIL /
 * PHOTO_SRC to update without touching layout.
 */

// EDIT THESE to update contact endpoints without touching layout.
const TWITTER_URL = 'https://x.com/Alok619308'
const EMAIL = 'hello@cuedesign.space'
const PHOTO_SRC = 'https://pbs.twimg.com/profile_images/2077750155353505792/Y3M2fdYV_400x400.jpg'
const INITIALS = 'A'                    // fallback avatar text
const FOUNDER_NAME = 'Alok'

const HINT_DISMISSED_KEY = 'cue.founder.hint.dismissed'

export default function FounderDock() {
  const { allPrompts } = useApp()
  // Round the live count down to the nearest 5 so the dock reads as
  // "75+", "80+", "85+" instead of an oddly specific "83+". Every
  // drop from the admin panel updates this automatically the next
  // time the client fetches the library.
  const componentCount = Math.floor(((allPrompts?.length) || 0) / 5) * 5
  const componentLabel = componentCount > 0 ? `${componentCount}+` : '75+'
  const [expanded, setExpanded] = useState(false)
  const [hintVisible, setHintVisible] = useState(() => {
    try { return localStorage.getItem(HINT_DISMISSED_KEY) !== '1' } catch { return true }
  })
  const rootRef = useRef(null)
  const hoverGraceRef = useRef(null)

  // Dismiss the hint permanently the first time the user opens the
  // card — the arrow only exists to teach that the avatar is clickable.
  useEffect(() => {
    if (!expanded) return
    if (!hintVisible) return
    setHintVisible(false)
    try { localStorage.setItem(HINT_DISMISSED_KEY, '1') } catch {}
  }, [expanded, hintVisible])

  // Tap-outside collapses on touch devices where hover doesn't apply.
  useEffect(() => {
    if (!expanded) return
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setExpanded(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setExpanded(false) }
    document.addEventListener('mousedown', onDocClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDocClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [expanded])

  const onMouseEnter = () => {
    if (hoverGraceRef.current) { clearTimeout(hoverGraceRef.current); hoverGraceRef.current = null }
    setExpanded(true)
  }
  const onMouseLeave = () => {
    // Small grace period so users can move their cursor from the
    // avatar to the expanded card without it collapsing mid-motion.
    hoverGraceRef.current = setTimeout(() => setExpanded(false), 160)
  }

  return (
    <div
      ref={rootRef}
      className={`cue-founder-dock ${expanded ? 'is-expanded' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {hintVisible && !expanded && (
        <div className="cue-founder-hint" aria-hidden="true">
          <div className="cue-founder-hint-text">Any doubts? DM me</div>
          <svg
            className="cue-founder-hint-arrow"
            width="70" height="56" viewBox="0 0 70 56" fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 6 C 20 6, 40 14, 58 44"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              fill="none"
            />
            <path
              d="M50 40 L 60 46 L 55 34"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
          </svg>
        </div>
      )}

      <button
        type="button"
        aria-label={`Contact ${FOUNDER_NAME}`}
        aria-expanded={expanded}
        className="cue-founder-avatar"
        onClick={() => setExpanded((v) => !v)}
      >
        {PHOTO_SRC ? (
          <img src={PHOTO_SRC} alt={`${FOUNDER_NAME}, founder of Cue`} />
        ) : (
          <span className="cue-founder-initials">{INITIALS}</span>
        )}
        <span className="cue-founder-online" aria-hidden="true" />
        {/* Subtle gold pip — the ambient "there's something here"
            signal that draws curious visitors to hover the avatar.
            Sits above the online dot so both remain readable. */}
        <span className="cue-founder-coupon-pip" aria-hidden="true" />
      </button>

      <div className="cue-founder-panel" role="menu" aria-hidden={!expanded}>
        <div className="cue-founder-body">
          <div className="cue-founder-head">
            {PHOTO_SRC && (
              <div className="cue-founder-photo">
                <img src={PHOTO_SRC} alt={`${FOUNDER_NAME}, founder of Cue`} />
              </div>
            )}
            <div className="cue-founder-head-text">
              <div className="cue-founder-name-row">
                <span className="cue-founder-name">{FOUNDER_NAME}</span>
                <span className="cue-founder-verified" aria-label="Verified">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2l2.4 2.1 3.2-.5 1.4 2.9 2.9 1.4-.5 3.2L23 12l-2.1 2.4.5 3.2-2.9 1.4-1.4 2.9-3.2-.5L12 23l-2.4-2.1-3.2.5-1.4-2.9-2.9-1.4.5-3.2L1 12l2.1-2.4-.5-3.2 2.9-1.4 1.4-2.9 3.2.5L12 2z"/>
                    <path d="M9.5 12.5l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </span>
              </div>
              <div className="cue-founder-role">Founder · Cue</div>
              <p className="cue-founder-bio">
                Hand-picks every drop. Building the taste layer for AI components.
              </p>
            </div>
          </div>

          <div className="cue-founder-stats">
            <div className="cue-founder-stat">
              <div className="cue-founder-stat-value">{componentLabel}</div>
              <div className="cue-founder-stat-label">Components</div>
            </div>
            <div className="cue-founder-stat">
              <div className="cue-founder-stat-value">~6h</div>
              <div className="cue-founder-stat-label">Reply</div>
            </div>
            <div className="cue-founder-stat">
              <div className="cue-founder-stat-value">Daily</div>
              <div className="cue-founder-stat-label">Drops</div>
            </div>
          </div>

          <div className="cue-founder-cta-row">
            <a
              href={TWITTER_URL}
              target="_blank"
              rel="noreferrer noopener"
              className="cue-founder-btn cue-founder-btn-primary"
              role="menuitem"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2H21l-6.522 7.457L22 22h-6.828l-5.35-6.99L3.6 22H.844l6.98-7.977L2 2h6.914l4.85 6.4L18.244 2Zm-2.396 18h1.62L8.28 4H6.56l9.288 16Z"/>
              </svg>
              <span>DM on X</span>
            </a>
            <a
              href={`mailto:${EMAIL}?subject=${encodeURIComponent('Hi Alok — about Cue')}`}
              className="cue-founder-btn cue-founder-btn-secondary"
              role="menuitem"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="14" rx="2"/>
                <path d="M3 7l9 6 9-6"/>
              </svg>
              <span>Email</span>
            </a>
          </div>
          {/* Hire me — full-width blue CTA below the DM/Email row.
              Dispatches the same custom event the footer uses so the
              global HireModal opens from wherever the dock is
              rendered without prop drilling. */}
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('cue:openHire'))}
            className="cue-founder-btn cue-founder-btn-hire"
            role="menuitem"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20l9-16H3z"/>
            </svg>
            <span>Hire me for your project</span>
          </button>
          {/* Coupon hint — the founding-rate CUE49 code lives here.
              A small gold pip on the avatar draws the eye; hovering
              onto this line reveals the code so users who bother to
              open the card get rewarded. */}
          <div className="cue-founder-coupon">
            <span className="cue-founder-coupon-eyebrow">Coupon code · $49 lifetime</span>
            <button
              type="button"
              className="cue-founder-coupon-code"
              onClick={() => {
                try {
                  navigator.clipboard?.writeText('CUE49')
                } catch {}
              }}
              title="Click to copy CUE49"
            >
              CUE49
            </button>
            <span className="cue-founder-coupon-body">Click to copy · apply at checkout</span>
          </div>
        </div>
      </div>

      <style>{`
        .cue-founder-dock {
          position: fixed; bottom: 24px; right: 24px; z-index: 125;
          font-family: var(--font-sans, system-ui, sans-serif);
        }
        .cue-founder-avatar {
          position: relative;
          width: 48px; height: 48px; padding: 0;
          border-radius: 999px;
          border: 2px solid rgba(255,255,255,0.14);
          background: linear-gradient(135deg, #2255dd 0%, #6c1cff 100%);
          color: #fff;
          cursor: pointer;
          display: inline-flex; align-items: center; justify-content: center;
          box-shadow: 0 12px 32px -12px rgba(0,0,0,0.6), 0 0 0 4px rgba(59,130,246,0.10);
          overflow: hidden;
          transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
        }
        .cue-founder-avatar:hover,
        .cue-founder-dock.is-expanded .cue-founder-avatar {
          transform: translateY(-2px);
          border-color: rgba(59,130,246,0.45);
          box-shadow: 0 20px 44px -12px rgba(59,130,246,0.55), 0 0 0 6px rgba(59,130,246,0.14);
        }
        .cue-founder-avatar img {
          width: 100%; height: 100%; object-fit: cover; border-radius: 999px;
        }
        .cue-founder-initials {
          font-family: var(--font-serif, 'Fraunces', Georgia, serif);
          font-style: italic; font-weight: 400; font-size: 22px;
          line-height: 1; letter-spacing: -0.01em;
        }
        .cue-founder-online {
          position: absolute; bottom: 1px; right: 1px;
          width: 12px; height: 12px; border-radius: 999px;
          background: #22c55e;
          border: 2px solid #141416;
          box-shadow: 0 0 0 2px rgba(34,197,94,0.25);
        }
        .cue-founder-coupon-pip {
          position: absolute; top: 1px; right: 1px;
          width: 10px; height: 10px; border-radius: 999px;
          background: #ccff00;
          border: 2px solid #141416;
          box-shadow: 0 0 0 2px rgba(204,255,0,0.25);
          animation: cue-founder-coupon-pulse 2.4s ease-in-out infinite;
        }
        @keyframes cue-founder-coupon-pulse {
          0%, 100% { box-shadow: 0 0 0 2px rgba(204,255,0,0.20); }
          50%      { box-shadow: 0 0 0 6px rgba(204,255,0,0.02); }
        }

        .cue-founder-hint {
          position: absolute;
          right: 8px;
          bottom: 58px;
          display: flex; flex-direction: column; align-items: flex-end;
          gap: 2px;
          color: rgba(255,255,255,0.72);
          pointer-events: none;
          animation: cue-founder-hint-in 500ms ease-out both,
                     cue-founder-hint-bob 3.2s ease-in-out 700ms infinite;
        }
        .cue-founder-hint-text {
          padding: 0 4px;
          color: rgba(255,255,255,0.85);
          font-family: var(--font-serif, 'Fraunces', Georgia, serif);
          font-style: italic; font-size: 14px; font-weight: 400;
          white-space: nowrap;
          text-shadow: 0 2px 6px rgba(0,0,0,0.5);
        }
        .cue-founder-hint-arrow {
          color: rgba(255,255,255,0.62);
          margin-right: -6px;
          flex-shrink: 0;
        }
        @keyframes cue-founder-hint-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes cue-founder-hint-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3px); }
        }
        @media (max-width: 640px) {
          .cue-founder-hint { display: none; }
        }

        .cue-founder-panel {
          position: absolute; bottom: calc(100% + 12px); right: 0;
          width: 300px;
          background: #fff;
          border: 1px solid rgba(0,0,0,0.06);
          border-radius: 16px;
          box-shadow: 0 24px 60px -18px rgba(0,0,0,0.5);
          opacity: 0; transform: translateY(8px) scale(0.97);
          transform-origin: bottom right;
          pointer-events: none;
          overflow: hidden;
          transition: opacity 220ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .cue-founder-dock.is-expanded .cue-founder-panel {
          opacity: 1; transform: translateY(0) scale(1);
          pointer-events: auto;
        }
        .cue-founder-body {
          padding: 14px 14px 14px;
          color: #14110E;
        }
        .cue-founder-head {
          display: flex; align-items: flex-start; gap: 12px;
          margin-bottom: 12px;
        }
        .cue-founder-photo {
          position: relative;
          width: 60px; height: 60px;
          border-radius: 999px;
          overflow: hidden;
          background: #f3f2ee;
          flex-shrink: 0;
        }
        .cue-founder-photo img {
          width: 100%; height: 100%; object-fit: cover;
          display: block;
        }
        .cue-founder-photo-fade { display: none; }
        .cue-founder-head-text { flex: 1; min-width: 0; }
        .cue-founder-name-row {
          display: inline-flex; align-items: center; gap: 5px;
        }
        .cue-founder-name {
          font-family: var(--font-sans, system-ui, sans-serif);
          font-weight: 700; font-size: 15.5px;
          color: #14110E;
          letter-spacing: -0.01em; line-height: 1.1;
        }
        .cue-founder-verified {
          display: inline-flex; align-items: center; color: #1d9bf0;
        }
        .cue-founder-role {
          font-size: 10.5px; color: rgba(20,17,14,0.45);
          letter-spacing: 0.06em; text-transform: uppercase;
          margin-top: 3px; font-weight: 500;
        }
        .cue-founder-bio {
          font-size: 11.5px; line-height: 1.4;
          color: rgba(20,17,14,0.6);
          margin: 5px 0 0;
        }
        .cue-founder-stats {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 4px;
          padding: 10px 0;
          border-top: 1px solid rgba(0,0,0,0.08);
          border-bottom: 1px solid rgba(0,0,0,0.08);
          margin-bottom: 12px;
        }
        .cue-founder-stat { text-align: center; }
        .cue-founder-stat-value {
          font-family: var(--font-sans, system-ui, sans-serif);
          font-size: 12.5px; font-weight: 700;
          color: #14110E;
          letter-spacing: -0.01em;
        }
        .cue-founder-stat-label {
          font-size: 9.5px; color: rgba(20,17,14,0.45);
          letter-spacing: 0.02em;
          margin-top: 2px;
        }
        .cue-founder-cta-row {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .cue-founder-btn {
          display: inline-flex; align-items: center; justify-content: center;
          gap: 5px;
          padding: 9px 10px; border-radius: 999px;
          font-size: 12px; font-weight: 600;
          letter-spacing: 0.01em;
          cursor: pointer; text-decoration: none;
          transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease, border-color 160ms ease;
        }
        .cue-founder-btn-primary {
          background: #14110E; color: #fff;
          border: 1px solid #14110E;
        }
        .cue-founder-btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 20px -8px rgba(0,0,0,0.4);
        }
        .cue-founder-btn-secondary {
          background: #fff; color: #14110E;
          border: 1px solid rgba(20,17,14,0.15);
        }
        .cue-founder-coupon {
          margin-top: 14px;
          padding: 12px 12px 10px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(204,255,0,0.12), rgba(204,255,0,0.04));
          border: 1px solid rgba(204,255,0,0.30);
          display: flex; flex-direction: column; gap: 4px;
        }
        .cue-founder-coupon-eyebrow {
          font-size: 9.5px; letter-spacing: 0.14em; text-transform: uppercase;
          color: #6b8800; font-weight: 700;
        }
        .cue-founder-coupon-body {
          font-size: 11.5px; color: rgba(20,17,14,0.75);
          line-height: 1.45;
        }
        .cue-founder-coupon-body strong {
          background: #14110E; color: #ccff00;
          padding: 1px 6px; border-radius: 4px;
          font-family: 'SF Mono', ui-monospace, Menlo, monospace;
          font-size: 10.5px; letter-spacing: 0.03em;
        }
        .cue-founder-coupon-code {
          background: #14110E; color: #ccff00;
          border: none;
          padding: 8px 12px;
          border-radius: 8px;
          font-family: 'SF Mono', ui-monospace, Menlo, monospace;
          font-size: 15px; font-weight: 700;
          letter-spacing: 0.08em;
          cursor: pointer;
          text-align: center;
          margin: 4px 0 2px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .cue-founder-coupon-code:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 14px -4px rgba(0,0,0,0.35);
        }
        .cue-founder-btn-secondary:hover {
          background: #f7f6f2;
          border-color: rgba(20,17,14,0.25);
          transform: translateY(-1px);
        }
        .cue-founder-btn-hire {
          width: 100%;
          margin-top: 10px;
          background: #0000ff;
          color: #fff;
          border: 1px solid #0000ff;
          box-shadow: 0 6px 18px -6px rgba(0,0,255,0.55);
        }
        .cue-founder-btn-hire:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 22px -6px rgba(0,0,255,0.65);
          background: #1a1aff;
          border-color: #1a1aff;
        }

        @media (max-width: 480px) {
          .cue-founder-dock { bottom: 84px; right: 12px; }
          /* Sits above the FloatingNav pill which lives at bottom: 24 */
        }
      `}</style>
    </div>
  )
}
