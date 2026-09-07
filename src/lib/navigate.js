// ============================================================
// Cue — client-side navigation helper (real paths, not hashes)
// ============================================================
// Every internal navigation used to imperatively set
// window.location.hash = '#/foo'. That makes URLs like /#/foo,
// which Google reads as the same page (the hash is a fragment
// identifier). Result: 141 "indexed without content" pages.
//
// This helper pushes a REAL path via history.pushState and fires
// a popstate event so App.jsx's route listener picks it up. Every
// caller that used to do `window.location.hash = '#/pricing'` now
// does `navigate('/pricing')`.
//
// Falls back to hash assignment on old browsers where pushState
// isn't available (< IE10 basically — vanishing minority).
// ============================================================

export function navigate(path) {
  if (typeof window === 'undefined') return
  // Accept both real paths ('/pricing') and legacy hash strings
  // ('#/pricing'). Normalise everything to a real path.
  let target = String(path || '/')
  if (target.startsWith('#/')) target = target.slice(1)
  if (!target.startsWith('/')) target = '/' + target

  try {
    if (typeof window.history?.pushState === 'function') {
      window.history.pushState({}, '', target)
      window.dispatchEvent(new PopStateEvent('popstate'))
      // Also clear any lingering hash so URL bar shows /pricing
      // instead of /pricing#/foo when we're navigating away from
      // an older hash route.
      return
    }
  } catch (_) { /* fall through */ }
  // Fallback — old browsers.
  try { window.location.hash = '#' + target } catch (_) {
    window.location.href = target
  }
}
