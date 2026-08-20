import { useEffect, useState, useRef } from 'react'

/**
 * Tracks whether the user is scrolling UP or DOWN. Used by the nav to
 * hide when scrolling down (give content room) and re-appear when
 * scrolling up (available on demand).
 *
 * - `topZone` — while scrollY is below this the nav is always shown.
 * - `threshold` — minimum delta before we flip direction. Prevents
 *   jitter when the user pauses mid-scroll (Chrome fires tiny deltas).
 */
export function useScrollDirection({ topZone = 80, threshold = 8 } = {}) {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(typeof window !== 'undefined' ? window.scrollY : 0)
  const ticking = useRef(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const update = () => {
      const y = window.scrollY
      const delta = y - lastY.current

      if (y < topZone) {
        // Near the top — always show. Prevents an awkward "half-hidden
        // at scrollY=5" flicker when the page loads and lenis snaps.
        setHidden(false)
      } else if (Math.abs(delta) > threshold) {
        setHidden(delta > 0)
      }

      lastY.current = y
      ticking.current = false
    }

    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(update)
        ticking.current = true
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [topZone, threshold])

  return hidden
}
