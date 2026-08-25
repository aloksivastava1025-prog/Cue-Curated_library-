import React, { useState } from 'react'
import { useUser, useClerk } from '@clerk/clerk-react'
// useClerk is used only for openUserProfile() below — signOut lives
// in the top-nav avatar dropdown.

/**
 * Floating bottom pill nav — appears after the user scrolls past the
 * hero (~400px). Thumb-reachable on mobile, elegant on desktop,
 * decoupled from Lenis smooth-scroll (no scroll direction detection —
 * just a threshold flip via IntersectionObserver on a sentinel).
 *
 * Props:
 *   visible — boolean, controlled by parent so the same threshold
 *             can flip the top nav's transform in sync.
 *   onOpenFeedback — opens the Suggest modal
 *   onOpenAuth — opens auth modal (only for signed-out users)
 *   spotsLeft — founding counter for Pricing label
 *   foundingFilled — boolean
 *   savedCount — number of saved items
 *   isAdmin — boolean
 */
export default function FloatingNav({
  visible,
  onOpenFeedback,
  onOpenAuth,
  spotsLeft,
  foundingFilled,
  savedCount,
  isAdmin,
}) {
  const { isSignedIn } = useUser()
  const { openUserProfile, signOut } = useClerk()
  const [menuOpen, setMenuOpen] = useState(false)

  const items = [
    {
      label: foundingFilled ? 'Pricing' : `Pricing · ${spotsLeft} left`,
      href: '#/pricing',
    },
    {
      label: 'Saved',
      href: '#/saved',
      badge: savedCount,
      hidden: !isSignedIn,
    },
    {
      label: 'Suggest',
      onClick: () => { setMenuOpen(false); onOpenFeedback?.('floating-nav') },
    },
    {
      label: 'Contact',
      href: '#/contact',
    },
    {
      label: 'Billing',
      href: '#/billing',
      hidden: !isSignedIn,
    },
    {
      label: 'Manage account',
      onClick: () => { setMenuOpen(false); openUserProfile() },
      hidden: !isSignedIn,
    },
    {
      label: 'Admin',
      href: '#/admin',
      hidden: !isAdmin,
    },
    // Sign out intentionally NOT in this pill — lives only in the
    // top nav's avatar dropdown so a mis-tap here can't drop you
    // out of your account mid-scroll.
  ].filter((i) => !i.hidden)

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  return (
    <>
      <style>{`
        /* Breathing outer glow — subtle brand halo pulse */
        @keyframes cue-floatnav-pulse {
          0%, 100% {
            filter: drop-shadow(0 4px 16px rgba(37,129,255,0.32));
          }
          50% {
            filter: drop-shadow(0 6px 24px rgba(37,129,255,0.55));
          }
        }
        .cue-floatnav-pill {
          animation: cue-floatnav-pulse 3.4s ease-in-out infinite;
          transition: transform 260ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .cue-floatnav-pill:hover {
          transform: translateY(-2px) scale(1.015);
        }
        /* Diagonal shine sweep — travels across every ~7s, subtle */
        .cue-floatnav-pill::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: linear-gradient(120deg, transparent 35%, rgba(255,255,255,0.35) 50%, transparent 65%);
          transform: translateX(-120%);
          animation: cue-floatnav-shine 6.5s ease-in-out infinite;
          pointer-events: none;
          mix-blend-mode: overlay;
          z-index: 1;
        }
        @keyframes cue-floatnav-shine {
          0%, 65%, 100% { transform: translateX(-120%); }
          80%           { transform: translateX(120%); }
        }
        /* Desktop scale-up — pill and its buttons a touch larger so it
           feels tap-target-generous with a mouse, without going oversize
           on mobile where thumb-reach and viewport space matter most. */
        @media (min-width: 768px) {
          .cue-floatnav-pill { gap: 6px !important; padding: 6px !important; }
          .cue-floatnav-pill > button {
            height: 38px !important;
            padding-left: 16px !important;
            padding-right: 16px !important;
            font-size: 13.5px !important;
          }
          .cue-floatnav-pill > span { height: 22px !important; }
          /* Menu sheet wider on desktop so links feel airier */
          .cue-floatnav-sheet {
            width: min(340px, calc(100vw - 48px)) !important;
            padding: 8px !important;
          }
          .cue-floatnav-sheet a,
          .cue-floatnav-sheet button {
            padding: 12px 14px !important;
            font-size: 14px !important;
          }
        }
      `}</style>
      <div
        className={`cue-floatnav ${visible ? 'cue-floatnav-visible' : ''}`}
        style={{
          position: 'fixed',
          bottom: 24,
          left: '50%',
          zIndex: 150,
          transform: visible
            ? 'translate(-50%, 0) scale(1)'
            : 'translate(-50%, 24px) scale(0.92)',
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          transition: 'transform 380ms cubic-bezier(0.22, 1, 0.36, 1), opacity 260ms ease',
        }}
      >
        <div
          className="cue-floatnav-pill"
          style={{
            position: 'relative',
            overflow: 'hidden',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: 5,
            // Reference-matched CTA glass. Vibrant blue base with a
            // radial hotspot near the top-center, wrapped by a thick
            // white inset rim on all four sides — reads as a frosted
            // pill with a glowing blue core.
            background:
              'radial-gradient(120% 140% at 50% 20%, #1674F7 0%, rgba(22,116,247,0) 70%), #2581FF',
            border: '1px solid rgba(255,255,255,0.6)',
            borderRadius: 5,
            boxShadow: [
              // Frosted white rim on all four sides — creates the
              // ethereal "lit-from-within" look
              'inset 0 -14px 20px rgba(255,255,255,0.95)',
              'inset 0 6px 16px rgba(255,255,255,0.80)',
              'inset 8px 0 16px rgba(255,255,255,0.70)',
              'inset -8px 0 16px rgba(255,255,255,0.70)',
              // Outer depth + brand halo
              '0 10px 20px rgba(0,0,0,0.30)',
              '0 4px 16px rgba(37,129,255,0.35)',
            ].join(', '),
            fontFamily: 'var(--font-sans)',
          }}
        >
          {/* cue wordmark — tap to jump to top */}
          <button
            onClick={scrollTop}
            aria-label="Back to top"
            style={{
              position: 'relative', zIndex: 2,
              height: 30, borderRadius: 4,
              padding: '0 10px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#0C2E63',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 12,
              letterSpacing: '-0.01em',
              textShadow: '0 1px 2px rgba(255,255,255,0.6)',
              transition: 'background 160ms ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.30)' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
          >
            cue
          </button>

          {/* Menu button */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            style={{
              position: 'relative', zIndex: 2,
              display: 'inline-flex', alignItems: 'center', gap: 7,
              padding: '0 12px', height: 30, borderRadius: 4,
              background: menuOpen ? 'rgba(255,255,255,0.35)' : 'transparent',
              border: 'none', cursor: 'pointer',
              color: '#0C2E63',
              fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
              textShadow: '0 1px 2px rgba(255,255,255,0.6)',
              transition: 'background 160ms ease',
            }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 220ms ease', transform: menuOpen ? 'rotate(90deg)' : 'rotate(0)' }}>
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </svg>
            <span>Menu</span>
          </button>

          {/* Join Cue chip — only for signed-out users. Signed-in
              users get account / billing / sign out inside the Menu
              sheet, so the pill stays compact either way. */}
          {!isSignedIn && (
            <>
              <span style={{ position: 'relative', zIndex: 2, width: 1, height: 18, background: 'rgba(12,46,99,0.28)' }} />
              <button
                onClick={() => onOpenAuth?.('sign-in')}
                style={{
                  position: 'relative', zIndex: 2,
                  padding: '0 12px', height: 30, borderRadius: 4,
                  background: '#0C2E63', color: '#fff',
                  border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, letterSpacing: '-0.01em',
                  boxShadow: '0 4px 10px -2px rgba(12,46,99,0.5)',
                }}
              >Login</button>
            </>
          )}
        </div>

        {/* Expanded menu sheet — anchored above the pill */}
        <div
          className="cue-floatnav-sheet"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 10px)',
            left: '50%',
            transform: menuOpen
              ? 'translate(-50%, 0) scale(1)'
              : 'translate(-50%, 8px) scale(0.96)',
            opacity: menuOpen ? 1 : 0,
            pointerEvents: menuOpen ? 'auto' : 'none',
            transition: 'transform 280ms cubic-bezier(0.22, 1, 0.36, 1), opacity 200ms ease',
            width: 'min(260px, calc(100vw - 32px))',
            background: '#0e0e10',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14,
            padding: 6,
            boxShadow: '0 30px 80px -12px rgba(0,0,0,0.75)',
            transformOrigin: 'bottom center',
          }}
          role="menu"
        >
          {items.map((it, i) => {
            const inner = (
              <>
                <span>{it.label}</span>
                {typeof it.badge === 'number' && it.badge > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: 10.5, fontWeight: 700,
                    padding: '2px 7px', borderRadius: 999,
                    background: 'var(--electric)', color: '#fff',
                  }}>{it.badge}</span>
                )}
              </>
            )
            const isDanger = Boolean(it.danger)
            const style = {
              display: 'flex', alignItems: 'center',
              padding: '10px 12px', borderRadius: 8,
              color: isDanger ? '#ff6b6b' : 'var(--text)', textDecoration: 'none',
              fontSize: 13, fontWeight: 500,
              background: 'transparent', border: 'none', cursor: 'pointer',
              textAlign: 'left', width: '100%',
              transition: 'background 140ms ease',
            }
            const hoverIn = (e) => {
              e.currentTarget.style.background = isDanger ? 'rgba(255,107,107,0.10)' : 'rgba(255,255,255,0.05)'
            }
            const hoverOut = (e) => { e.currentTarget.style.background = 'transparent' }
            const node = it.href ? (
              <a key={i} href={it.href} style={style} onClick={() => setMenuOpen(false)} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>{inner}</a>
            ) : (
              <button key={i} onClick={it.onClick} style={style} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>{inner}</button>
            )
            return it.dividerAbove ? (
              <React.Fragment key={i}>
                <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 8px' }} />
                {node}
              </React.Fragment>
            ) : node
          })}
        </div>
      </div>

      {/* Tap-away layer */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 149, background: 'transparent' }}
        />
      )}
    </>
  )
}
