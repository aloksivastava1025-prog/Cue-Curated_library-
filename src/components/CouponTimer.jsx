import React, { useEffect, useState } from 'react'

/**
 * Subtle 24-hour founding-rate timer.
 *
 * Starts ticking the first time a visitor lands on the site, not
 * from when they unlock the coupon — the window is meant to be a
 * gentle nudge to hunt within 24 hours. Stores the start timestamp
 * in localStorage under the same key the pricing page reads, so if
 * the visitor comes back on day 2 with the timer at 0h the code
 * they enter will be rejected by the checkout anyway.
 *
 * Visual: no highlight, no border, muted 11px text. Sits wherever
 * the parent decides — the whole point is that a user can glance at
 * the corner and see "22h 14m" without the page feeling like a
 * carnival banner.
 */

const START_KEY = 'cue.coupon.window.start'
const WINDOW_MS = 24 * 60 * 60 * 1000
const UNLOCK_KEY = 'cue.coupon.unlocked'

export default function CouponTimer({ style }) {
  const [remaining, setRemaining] = useState(null)

  useEffect(() => {
    // Bootstrap the start timestamp on the first render — no matter
    // what page the visitor lands on.
    let start = 0
    try {
      const raw = localStorage.getItem(START_KEY)
      if (raw) start = parseInt(raw, 10) || 0
      if (!start) {
        start = Date.now()
        localStorage.setItem(START_KEY, String(start))
      }
    } catch {}

    const compute = () => {
      // If they've already claimed the coupon, show no timer — the
      // ticker turns from a nudge into noise once the code is applied.
      let unlocked = false
      try { unlocked = !!localStorage.getItem(UNLOCK_KEY) } catch {}
      if (unlocked) { setRemaining(0); return }
      const end = start + WINDOW_MS
      setRemaining(Math.max(0, end - Date.now()))
    }
    compute()
    const id = setInterval(compute, 30_000) // half-minute is enough resolution
    return () => clearInterval(id)
  }, [])

  if (remaining === null) return null
  if (remaining <= 0) return null

  const totalMin = Math.floor(remaining / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  const label = h > 0 ? `${h}h ${m}m` : `${m}m`

  return (
    <div style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 11,
      color: 'rgba(255,255,255,0.42)',
      letterSpacing: '0.02em',
      fontFamily: 'var(--font-sans, system-ui)',
      ...style,
    }}>
      <span aria-hidden="true" style={{
        display: 'inline-block',
        width: 5, height: 5, borderRadius: 999,
        background: 'rgba(255,255,255,0.35)',
      }} />
      <span>founding rate · {label} left</span>
    </div>
  )
}
