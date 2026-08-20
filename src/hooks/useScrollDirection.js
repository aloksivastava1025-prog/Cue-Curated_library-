import { useEffect, useState, useRef } from 'react'

/**
 * Tracks whether the user is scrolling UP or DOWN. Used by the nav to
 * hide when scrolling down (give content room) and re-appear when
 * scrolling up (available on demand).
 *
 * Uses rAF polling instead of the `scroll` event because Lenis smooth
 * scroll swallows/re-dispatches scroll events unpredictably. Reading
 * window.scrollY on every frame is cheap and always in sync with the
 * paint the user is actually seeing.
 *
 * - `topZone` — while scrollY is below this the nav is always shown.
 * - `threshold` — minimum accumulated delta before we flip direction.
 *   Prevents jitter when the user pauses mid-scroll.
 */
export function useScrollDirection({ topZone = 80, threshold = 8 } = {}) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    let rafId
    let lastY = window.scrollY
    let lastDirY = lastY // reference point for direction changes
    let currentHidden = false

    const tick = () => {
      const y = window.scrollY

      if (y < topZone) {
        if (currentHidden) { currentHidden = false; setHidden(false) }
        lastDirY = y
      } else if (y > lastDirY + threshold) {
        // Scrolling DOWN past threshold — hide.
        if (!currentHidden) { currentHidden = true; setHidden(true) }
        lastDirY = y
      } else if (y < lastDirY - threshold) {
        // Scrolling UP past threshold — show.
        if (currentHidden) { currentHidden = false; setHidden(false) }
        lastDirY = y
      }

      lastY = y
      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [topZone, threshold])

  return hidden
}
