import { useEffect, useState } from 'react'

/**
 * Hide-on-scroll-down, show-on-scroll-up nav pattern.
 *
 * Uses rAF polling because Lenis smooth scroll swallows/re-dispatches
 * scroll events unpredictably. Reading window.scrollY on every frame
 * is cheap and always in sync with the paint the user is seeing.
 */
export function useScrollDirection(topZone = 80, threshold = 8) {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let rafId = 0
    let lastDirY = window.scrollY
    let currentHidden = false

    function tick() {
      const y = window.scrollY

      if (y < topZone) {
        if (currentHidden) { currentHidden = false; setHidden(false) }
        lastDirY = y
      } else if (y > lastDirY + threshold) {
        if (!currentHidden) { currentHidden = true; setHidden(true) }
        lastDirY = y
      } else if (y < lastDirY - threshold) {
        if (currentHidden) { currentHidden = false; setHidden(false) }
        lastDirY = y
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [topZone, threshold])

  return hidden
}
