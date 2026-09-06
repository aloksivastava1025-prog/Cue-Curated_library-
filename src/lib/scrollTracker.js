// ============================================================
// Cue — single global scroll tracker
// ============================================================
// One passive scroll listener at module load, shared by every card
// component that wants to know "did the page just scroll?" (used
// by EditorialCard, FeaturedCard, CategoryCard for scroll-vs-tap
// disambiguation on mobile).
//
// The naive approach — every card useEffect + own window listener —
// causes visible jank on grids with 100+ cards because every scroll
// event fires 100+ handlers. This module registers ONE listener and
// exposes a read function that costs nothing per card.
// ============================================================

let lastScrollAt = 0

if (typeof window !== 'undefined') {
  window.addEventListener(
    'scroll',
    () => { lastScrollAt = Date.now() },
    { passive: true, capture: true },
  )
}

export function getLastScrollAt() { return lastScrollAt }
