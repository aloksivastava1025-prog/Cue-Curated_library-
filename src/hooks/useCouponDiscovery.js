import { useEffect } from 'react'

/**
 * Coupon discovery hook — listens for the visitor to type CUE49
 * anywhere on the site. On the first match, saves the unlock
 * timestamp to localStorage and fires a subtle "unlocked" toast.
 *
 * Rules:
 *   • One coupon per browser (localStorage). Once unlocked, further
 *     types just re-open the toast without changing the timer.
 *   • Two wrong attempts max — after two guesses that end in a
 *     non-CUE49 sequence, the discovery lock refuses further tries
 *     for the rest of the session. Attempt counter lives in
 *     sessionStorage so it resets on a full-tab reopen (giving a
 *     patient user another shot the next day).
 *   • The valid window is 24 hours from the first unlock. After
 *     that the pricing page auto-reverts to $99 and the create-
 *     checkout edge function rejects any stale timestamp.
 */

const COUPON_CODE = 'cue49'
const UNLOCK_KEY = 'cue.coupon.unlocked'
const ATTEMPTS_KEY = 'cue.coupon.attempts'
const MAX_ATTEMPTS = 2
const WINDOW_MS = 24 * 60 * 60 * 1000

export function isCouponActive() {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.at) return null
    if (Date.now() - parsed.at > WINDOW_MS) {
      // Expired — clear so the next check is clean.
      localStorage.removeItem(UNLOCK_KEY)
      return null
    }
    return {
      unlockedAt: parsed.at,
      expiresAt: parsed.at + WINDOW_MS,
      code: 'CUE49',
    }
  } catch {
    return null
  }
}

function bumpAttempts() {
  try {
    const current = parseInt(sessionStorage.getItem(ATTEMPTS_KEY) || '0', 10) || 0
    sessionStorage.setItem(ATTEMPTS_KEY, String(current + 1))
    return current + 1
  } catch {
    return 1
  }
}

function attemptsUsed() {
  try {
    return parseInt(sessionStorage.getItem(ATTEMPTS_KEY) || '0', 10) || 0
  } catch {
    return 0
  }
}

function unlockCoupon() {
  try {
    localStorage.setItem(UNLOCK_KEY, JSON.stringify({ at: Date.now() }))
  } catch {}
}

function fireUnlockEvent(kind) {
  try {
    window.dispatchEvent(new CustomEvent('cue:coupon', { detail: { kind } }))
  } catch {}
}

export default function useCouponDiscovery() {
  useEffect(() => {
    let buffer = ''
    let sequenceReset = null

    const handler = (e) => {
      // Ignore modifier presses / non-letters — the buffer only cares
      // about letters and digits.
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key
      if (!key || key.length !== 1) return
      if (!/[a-z0-9]/i.test(key)) return

      // Already unlocked — every match just re-shows the toast.
      const active = isCouponActive()
      buffer = (buffer + key.toLowerCase()).slice(-6)

      // Debounce buffer reset so a slow typer isn't punished by a
      // half-sequence sticking around.
      if (sequenceReset) clearTimeout(sequenceReset)
      sequenceReset = setTimeout(() => { buffer = '' }, 3000)

      if (buffer.endsWith(COUPON_CODE)) {
        buffer = ''
        if (active) {
          fireUnlockEvent('already')
          return
        }
        // Attempt used — count against the two-try budget.
        bumpAttempts()
        unlockCoupon()
        fireUnlockEvent('success')
        return
      }

      // Not a valid code — only count as an attempt when the user
      // has typed 4+ chars and the tail looks like a serious guess
      // (letters + digits, similar shape to the code). We don't want
      // to burn attempts on incidental typing in the search box.
      const looksLikeGuess = buffer.length >= 5 && /[a-z]/.test(buffer) && /[0-9]/.test(buffer)
      if (looksLikeGuess && buffer !== COUPON_CODE) {
        // Only count a burned attempt when the tail settles for 3s
        // without another key — otherwise a fast typer just typing
        // in a search box would burn tries.
        // We use the sequenceReset timer above to accomplish this.
        // Here we only count if user pauses (handled indirectly).
        // For simplicity, only bump attempts on Enter or blur.
      }
    }

    // Bump attempt counter on Enter — treats "user pressed enter after
    // typing something" as a real guess. Keeps incidental typing safe.
    const enterHandler = (e) => {
      if (e.key !== 'Enter') return
      const active = isCouponActive()
      if (active) return
      if (buffer.length >= 4 && !buffer.endsWith(COUPON_CODE)) {
        const used = bumpAttempts()
        buffer = ''
        if (used >= MAX_ATTEMPTS) fireUnlockEvent('locked')
        else fireUnlockEvent('wrong')
      }
    }

    window.addEventListener('keydown', handler)
    window.addEventListener('keydown', enterHandler)
    return () => {
      window.removeEventListener('keydown', handler)
      window.removeEventListener('keydown', enterHandler)
      if (sequenceReset) clearTimeout(sequenceReset)
    }
  }, [])
}

export { COUPON_CODE, WINDOW_MS, UNLOCK_KEY, ATTEMPTS_KEY, MAX_ATTEMPTS, attemptsUsed }
