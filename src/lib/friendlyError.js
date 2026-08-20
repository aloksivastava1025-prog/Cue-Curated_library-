// ============================================================
// CUE — Human-safe error copy
// ============================================================
// User-facing surfaces should never leak "TypeError: Failed to
// fetch", "Edge Function returned non-2xx", "supabase.co", or any
// other implementation string. Pipe every error string through
// friendlyError() before rendering it in a UI slot.
//
// Rules:
//   - Network / DNS / fetch failure   → "connection hiccup" copy
//   - Edge function / supabase error  → "temporary glitch" copy
//   - Timeout                         → "took too long" copy
//   - Rate limit (429)                → "slow down" copy
//   - Auth (401/403)                  → "session issue" copy
//   - HTTP 5xx generic                → "on our end" copy
//   - Everything else                 → provided fallback, then
//                                       the original message ONLY if
//                                       it looks human-readable
// ============================================================

const TECHNICAL_PATTERNS = [
  /failed to fetch/i,
  /fetch failed/i,
  /networkerror/i,
  /load failed/i,
  /err_/i,                     // ERR_NETWORK, ERR_CONNECTION_REFUSED, ...
  /supabase/i,
  /edge function/i,
  /non-2xx/i,
  /functioninvocation/i,
  /aborted/i,
  /the operation was aborted/i,
]

const looksTechnical = (msg) => {
  if (!msg) return true
  return TECHNICAL_PATTERNS.some((re) => re.test(String(msg)))
}

/**
 * @param {unknown} err  — Error instance, string, or nullish
 * @param {string}  [fallback] — used if the error is technical-looking
 * @returns {string} A short, user-safe line to show in the UI
 */
export function friendlyError(err, fallback = "Something didn't go through. Give it another tap.") {
  const raw = (err && err.message) || (typeof err === 'string' ? err : '') || ''
  const lower = raw.toLowerCase()

  // Specific patterns first — most-specific → most-generic.
  if (/timeout|timed out|took too long/i.test(lower)) {
    return "That took a while. Check your connection and tap again."
  }
  if (/429|rate limit|too many requests/i.test(lower)) {
    return "You're moving fast — wait a few seconds and tap again."
  }
  if (/401|unauthori[sz]ed|session expired|not signed in/i.test(lower)) {
    return "Your session expired. Sign in again and retry."
  }
  if (/403|forbidden/i.test(lower)) {
    return "You don't have access to this. If that's a mistake, email hello@cuedesign.space."
  }
  if (/5\d\d|internal server|bad gateway|service unavailable/i.test(lower)) {
    return "Small glitch on our end. Try again in a moment."
  }
  if (
    /failed to fetch|fetch failed|networkerror|network error|load failed|err_network|err_connection|err_internet/i.test(lower)
    || (/network/i.test(lower) && /(fetch|error|failed|unreachable)/i.test(lower))
  ) {
    return "Connection hiccup — check your network and tap again."
  }

  // Fallthrough: if it looks like a raw technical message, hide it.
  if (looksTechnical(raw)) return fallback

  // Looks like a real, human-readable validation message (e.g.
  // "Please enter a valid email") — trust it.
  return raw || fallback
}

/**
 * Convenience for use inside catch blocks that report through a toast
 * or state setter. Adds a retry hint to any friendly line.
 */
export function friendlyErrorWithRetry(err, fallback) {
  const base = friendlyError(err, fallback)
  if (/tap again|retry|try again/i.test(base)) return base
  return `${base} You can retry in a moment.`
}
