import React from 'react'
import { useUser, useClerk } from '@clerk/clerk-react'
import { backend } from '../lib/backend.js'

/**
 * Custom UserButton replacement — hover-triggered dropdown built to
 * match Cue's dark editorial palette. Keeps the "aha" moments from
 * the reference (gradient avatar ring, staggered slide-in items,
 * PRO badge slot) but reuses Clerk's imperative API for the actual
 * account actions (openUserProfile, signOut) so we don't rebuild
 * a whole account UI.
 *
 * Usage: drop into any nav where <UserButton /> was — same visual
 * anchor, richer interaction.
 */
export default function CueUserMenu() {
  const { user, isSignedIn } = useUser()
  const { openUserProfile, signOut } = useClerk()
  const [plan, setPlan] = React.useState('free')

  React.useEffect(() => {
    let alive = true
    if (!isSignedIn || !user?.id) { setPlan('free'); return }
    backend.getMyProfile(user.id, user)
      .then((p) => { if (alive) setPlan(p?.plan || 'free') })
      .catch(() => { if (alive) setPlan('free') })
    return () => { alive = false }
  }, [isSignedIn, user?.id])

  if (!isSignedIn || !user) return null

  const isCuePlus = plan === 'cue_plus' || plan === 'cue_plus_team'
  const primaryEmail = user.primaryEmailAddress?.emailAddress
    || user.emailAddresses?.[0]?.emailAddress
    || ''
  const display = user.fullName
    || [user.firstName, user.lastName].filter(Boolean).join(' ')
    || primaryEmail.split('@')[0]
    || 'Account'
  const avatarSrc = user.imageUrl || user.profileImageUrl || null

  return (
    <div className="cue-user-menu">
      {/* Trigger — avatar with gradient ring */}
      <button className="cue-um-trigger" aria-label="Open account menu">
        <span className="cue-um-ring">
          <span className="cue-um-ring-inner">
            {avatarSrc ? (
              <img src={avatarSrc} alt="" />
            ) : (
              <span className="cue-um-avatar-initial">
                {display.charAt(0).toUpperCase()}
              </span>
            )}
          </span>
        </span>
      </button>

      {/* Dropdown */}
      <div className="cue-um-dropdown" role="menu">
        {/* Header — identity block */}
        <div className="cue-um-identity">
          <div className="cue-um-avatar-sm">
            {avatarSrc ? <img src={avatarSrc} alt="" /> : <span>{display.charAt(0).toUpperCase()}</span>}
          </div>
          <div className="cue-um-identity-text">
            <div className="cue-um-name">{display}</div>
            <div className="cue-um-email">{primaryEmail}</div>
          </div>
        </div>

        <div className="cue-um-divider" />

        {/* Top group — account + product actions */}
        <div className="cue-um-group">
          <button
            className="cue-um-item"
            onClick={() => openUserProfile()}
            type="button"
          >
            <IconAccount />
            <span>Manage account</span>
          </button>

          <a className="cue-um-item" href="#/billing">
            <IconReceipt />
            <span>Billing &amp; invoices</span>
            {isCuePlus && (
              <span className="cue-um-badge">
                <IconSpark />
                Cue+
              </span>
            )}
          </a>

          <a className="cue-um-item" href="#/contact">
            <IconMail />
            <span>Contact us</span>
          </a>
        </div>

        <div className="cue-um-divider" />

        {/* Bottom group — session */}
        <div className="cue-um-group">
          <button
            className="cue-um-item cue-um-danger"
            onClick={() => signOut()}
            type="button"
          >
            <IconSignOut />
            <span>Sign out</span>
          </button>
        </div>
      </div>

      {/* Scoped styles — kept in a single <style> so the component
          is drop-in with no build-tool CSS pipeline dependency. */}
      <style>{`
        .cue-user-menu {
          position: relative;
          display: inline-block;
        }
        .cue-um-trigger {
          background: transparent;
          border: none;
          padding: 0;
          cursor: pointer;
          border-radius: 999px;
          line-height: 0;
        }
        .cue-um-ring {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          padding: 2px;
          box-sizing: border-box;
          background: conic-gradient(from 220deg, #0000FF 0deg, #4d4dff 90deg, #ccff00 200deg, #0000FF 360deg);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .cue-user-menu:hover .cue-um-ring,
        .cue-user-menu:focus-within .cue-um-ring {
          transform: scale(1.06);
        }
        .cue-um-ring-inner {
          width: 100%;
          height: 100%;
          border-radius: 999px;
          background: #0A0A0A;
          padding: 2px;
          box-sizing: border-box;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        .cue-um-ring-inner img {
          width: 100%;
          height: 100%;
          border-radius: 999px;
          object-fit: cover;
        }
        .cue-um-avatar-initial {
          font-family: var(--font-sans);
          font-weight: 600;
          font-size: 13px;
          color: var(--text);
        }

        .cue-um-dropdown {
          position: absolute;
          top: calc(100% + 12px);
          right: 0;
          width: 268px;
          background: #0e0e10;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          box-shadow:
            0 20px 44px rgba(0,0,0,0.55),
            0 4px 14px rgba(0,0,0,0.4);
          padding: 8px;
          z-index: 200;
          opacity: 0;
          visibility: hidden;
          transform: scale(0.96) translateY(-8px);
          transform-origin: top right;
          transition: opacity 0.22s cubic-bezier(0.22, 1, 0.36, 1),
                      transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
                      visibility 0.22s;
          pointer-events: none;
        }
        .cue-user-menu:hover .cue-um-dropdown,
        .cue-user-menu:focus-within .cue-um-dropdown {
          opacity: 1;
          visibility: visible;
          transform: scale(1) translateY(0);
          pointer-events: auto;
        }

        /* Bridge the gap between trigger and dropdown so a hover-out
           on the gap doesn't kill the menu mid-move. */
        .cue-um-dropdown::before {
          content: '';
          position: absolute;
          top: -14px; left: 0; right: 0; height: 14px;
        }

        .cue-um-identity {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px 8px;
        }
        .cue-um-avatar-sm {
          width: 32px; height: 32px; border-radius: 999px;
          background: #1c1c1e;
          display: inline-flex; align-items: center; justify-content: center;
          overflow: hidden; flex-shrink: 0;
          color: var(--text-dim);
          font-family: var(--font-sans); font-weight: 600; font-size: 13px;
        }
        .cue-um-avatar-sm img {
          width: 100%; height: 100%; border-radius: 999px; object-fit: cover;
        }
        .cue-um-identity-text { min-width: 0; }
        .cue-um-name {
          font-family: var(--font-sans);
          font-size: 13px; font-weight: 600;
          color: var(--text);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .cue-um-email {
          font-family: var(--font-sans);
          font-size: 11.5px;
          color: var(--text-dim);
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .cue-um-divider {
          height: 1px;
          background: rgba(255,255,255,0.06);
          margin: 6px 4px;
        }

        .cue-um-group { display: flex; flex-direction: column; gap: 2px; }
        .cue-um-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 9px 12px;
          border-radius: 8px;
          text-decoration: none;
          color: var(--text);
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 500;
          background: transparent;
          border: none;
          cursor: pointer;
          width: 100%;
          text-align: left;
          transition: background 0.15s ease;
          opacity: 0;
          animation-fill-mode: forwards;
        }
        .cue-um-item svg {
          width: 16px; height: 16px;
          stroke: var(--text-dim);
          stroke-width: 1.6;
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
          flex-shrink: 0;
          transition: stroke 0.15s ease;
        }
        .cue-um-item:hover {
          background: rgba(255,255,255,0.04);
        }
        .cue-um-item:hover svg {
          stroke: var(--text);
        }
        .cue-um-item:active { transform: scale(0.99); }
        .cue-um-danger { color: #ff6b6b; }
        .cue-um-danger svg { stroke: #ff6b6b; }
        .cue-um-danger:hover { background: rgba(255,107,107,0.08); }
        .cue-um-danger:hover svg { stroke: #ff6b6b; }

        .cue-um-badge {
          margin-left: auto;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(204,255,0,0.12);
          color: #ccff00;
          border: 1px solid rgba(204,255,0,0.35);
          padding: 3px 7px;
          border-radius: 999px;
          font-family: var(--font-sans);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          line-height: 1;
        }
        .cue-um-badge svg {
          width: 9px; height: 9px;
          stroke: none;
          fill: #ccff00;
        }

        /* Staggered slide-in on open (matches the reference micro-motion) */
        .cue-user-menu:hover .cue-um-item,
        .cue-user-menu:focus-within .cue-um-item {
          animation: cue-um-slide 0.36s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .cue-user-menu:hover .cue-um-group:nth-of-type(1) .cue-um-item:nth-child(1),
        .cue-user-menu:focus-within .cue-um-group:nth-of-type(1) .cue-um-item:nth-child(1) { animation-delay: 0.04s; }
        .cue-user-menu:hover .cue-um-group:nth-of-type(1) .cue-um-item:nth-child(2),
        .cue-user-menu:focus-within .cue-um-group:nth-of-type(1) .cue-um-item:nth-child(2) { animation-delay: 0.07s; }
        .cue-user-menu:hover .cue-um-group:nth-of-type(1) .cue-um-item:nth-child(3),
        .cue-user-menu:focus-within .cue-um-group:nth-of-type(1) .cue-um-item:nth-child(3) { animation-delay: 0.10s; }
        .cue-user-menu:hover .cue-um-group:nth-of-type(2) .cue-um-item,
        .cue-user-menu:focus-within .cue-um-group:nth-of-type(2) .cue-um-item { animation-delay: 0.13s; }

        @keyframes cue-um-slide {
          from { opacity: 0; transform: translateX(-4px); }
          to   { opacity: 1; transform: translateX(0);    }
        }

        /* On very narrow screens, pin the dropdown a bit further from the edge. */
        @media (max-width: 480px) {
          .cue-um-dropdown { width: 260px; right: -4px; }
        }
      `}</style>
    </div>
  )
}

/* ---- Icons — thin monoline, matches CUE's overall vocabulary ---- */

function IconAccount() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-3.5 4.7-5 8-5s6.5 1.5 8 5" />
    </svg>
  )
}
function IconReceipt() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M5 3v18l3-2 3 2 3-2 3 2 3-2 V3z" />
      <path d="M9 8h6M9 12h6M9 16h4" />
    </svg>
  )
}
function IconMail() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  )
}
function IconSignOut() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M15 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h10" />
      <polyline points="17 16 21 12 17 8" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}
function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <polygon points="12 2 14.09 8.26 20 9.27 15.5 13.14 16.82 20 12 16.77 7.18 20 8.5 13.14 4 9.27 9.91 8.26 12 2" />
    </svg>
  )
}
