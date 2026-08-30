// ============================================================
// Cue — video mount governor (defence in depth)
// ============================================================
// Every mounted <video> element on this site consumes egress. The
// primary defence lives in the components themselves (mount only on
// user intent — see EditorialCard/FeaturedRail). This module is a
// last-line safety net: even if a future component regresses to
// mounting videos in bulk, this governor caps the *total number*
// of active hover clips at MAX_ACTIVE. Anything beyond that is
// asked to hold off — the component renders its poster/thumbnail
// only and does not attach a <video> element.
//
// Usage:
//   const g = useVideoSlot('editorial-card', item.id)
//   if (g.granted) { render <video> ... }
//   else           { render <img poster> only }
//
// If the slot is denied on first render, it will be granted as
// soon as another slot releases (mouseleave / unmount / etc.). The
// hook subscribes to the pool so re-renders happen automatically.
// ============================================================

import { useEffect, useState } from 'react'

// Empirically 20 active hover clips is far past what any real user
// interacts with simultaneously — hovering more than a few is
// physically impossible. Bumping this ceiling should require a
// clear reason.
const MAX_ACTIVE = 20

// { owner: string, id: string } — dedup by (owner, id) so a
// component re-rendering doesn't burn multiple slots.
const active = new Set()
const listeners = new Set()

function key(owner, id) { return `${owner}::${id}` }

function notify() {
  for (const fn of listeners) fn()
}

function tryClaim(owner, id) {
  const k = key(owner, id)
  if (active.has(k)) return true
  if (active.size >= MAX_ACTIVE) return false
  active.add(k)
  notify()
  return true
}

function release(owner, id) {
  const k = key(owner, id)
  if (!active.delete(k)) return
  notify()
}

/**
 * Request a video-mount slot. Pass `enabled = false` to release the
 * slot without unmounting the component. The hook re-tries on every
 * pool change so a denied request is granted as soon as capacity
 * frees up.
 *
 * @param {string} owner  - identifier of the component ("editorial-card")
 * @param {string} id     - unique per row / item (item.id)
 * @param {boolean} enabled - when false, the slot is released
 * @returns {{ granted: boolean }}
 */
export function useVideoSlot(owner, id, enabled = true) {
  const [granted, setGranted] = useState(() => enabled && tryClaim(owner, id))

  useEffect(() => {
    if (!enabled) {
      release(owner, id)
      setGranted(false)
      return
    }
    // Try to claim on mount / prop change
    if (tryClaim(owner, id)) {
      setGranted(true)
    } else {
      setGranted(false)
      const retry = () => {
        if (tryClaim(owner, id)) {
          setGranted(true)
        }
      }
      listeners.add(retry)
      return () => {
        listeners.delete(retry)
        release(owner, id)
      }
    }
    return () => { release(owner, id) }
  }, [owner, id, enabled])

  return { granted }
}

// Test / debug hook — returns current pool size. Not used in prod
// code paths but handy in the browser console via
// `window.__cueVideoGov()`.
if (typeof window !== 'undefined') {
  window.__cueVideoGov = () => ({ active: active.size, max: MAX_ACTIVE, keys: [...active] })
}
