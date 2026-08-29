import React, { useEffect, useState } from 'react'
import useCouponDiscovery, { isCouponActive, WINDOW_MS, MAX_ATTEMPTS, attemptsUsed } from '../hooks/useCouponDiscovery.js'

/**
 * Global coupon toast. Mounts once at the app shell and listens for
 * the `cue:coupon` custom event fired by useCouponDiscovery.
 *   • success  → celebratory "unlocked." card with the code + expiry
 *   • already  → gentle "you already have it" reminder
 *   • wrong    → tiny "not quite. try again." tick
 *   • locked   → two-try budget exhausted
 */

export default function CouponToast() {
  useCouponDiscovery()
  const [toast, setToast] = useState(null)

  useEffect(() => {
    const onEvent = (e) => {
      const kind = e?.detail?.kind || 'success'
      if (kind === 'success') {
        const active = isCouponActive()
        setToast({
          kind,
          title: 'unlocked.',
          sub: `CUE49 · save 50% · expires in ${prettyDuration(active ? active.expiresAt - Date.now() : WINDOW_MS)}`,
        })
      } else if (kind === 'already') {
        const active = isCouponActive()
        setToast({
          kind,
          title: 'already yours.',
          sub: active ? `CUE49 · ${prettyDuration(active.expiresAt - Date.now())} left` : 'CUE49',
        })
      } else if (kind === 'wrong') {
        const used = attemptsUsed()
        setToast({
          kind,
          title: 'not quite.',
          sub: `${Math.max(MAX_ATTEMPTS - used, 0)} of ${MAX_ATTEMPTS} tries left`,
        })
      } else if (kind === 'locked') {
        setToast({
          kind,
          title: 'no more tries this session.',
          sub: 'come back tomorrow with a fresh guess.',
        })
      }
    }
    window.addEventListener('cue:coupon', onEvent)
    return () => window.removeEventListener('cue:coupon', onEvent)
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), toast.kind === 'success' ? 6000 : 3200)
    return () => clearTimeout(t)
  }, [toast])

  if (!toast) return null

  const isSuccess = toast.kind === 'success' || toast.kind === 'already'

  return (
    <div className="cue-coupon-toast">
      <div className={`cue-coupon-toast-body ${toast.kind}`}>
        <div className="cue-coupon-toast-title">{toast.title}</div>
        <div className="cue-coupon-toast-sub">{toast.sub}</div>
        {isSuccess && (
          <div className="cue-coupon-toast-cta">
            <a href="#/pricing" className="cue-coupon-toast-link">claim at checkout →</a>
          </div>
        )}
      </div>
      <style>{`
        .cue-coupon-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 250;
          animation: cue-coupon-toast-in 320ms cubic-bezier(0.22, 1, 0.36, 1);
          font-family: var(--font-sans, system-ui);
        }
        @keyframes cue-coupon-toast-in {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cue-coupon-toast-body {
          background: #14110E;
          color: var(--text, #f2f2ef);
          border: 1px solid rgba(204,255,0,0.35);
          border-radius: 12px;
          padding: 14px 18px 12px;
          box-shadow: 0 20px 40px -12px rgba(0,0,0,0.55);
          min-width: 260px;
          max-width: 340px;
        }
        .cue-coupon-toast-body.wrong,
        .cue-coupon-toast-body.locked {
          border-color: rgba(255,107,107,0.35);
        }
        .cue-coupon-toast-title {
          font-family: var(--font-serif, 'Fraunces', Georgia, serif);
          font-style: italic; font-size: 20px; font-weight: 300;
          letter-spacing: -0.01em;
          margin-bottom: 4px;
        }
        .cue-coupon-toast-sub {
          font-size: 12px; color: var(--text-dim, #8a8a82);
          line-height: 1.45;
          letter-spacing: 0.005em;
        }
        .cue-coupon-toast-cta { margin-top: 8px; }
        .cue-coupon-toast-link {
          font-size: 12px;
          color: #ccff00;
          text-decoration: none;
          font-weight: 500;
        }
        .cue-coupon-toast-link:hover { text-decoration: underline; }
      `}</style>
    </div>
  )
}

function prettyDuration(ms) {
  const totalMin = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}
