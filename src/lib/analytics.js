// ============================================================
// CUE — Product analytics (PostHog)
// ============================================================
// Autocapture (pageviews + clicks) is enabled by default. On top of
// that we fire named custom events at the funnel-critical steps
// (sign-in, prompt copy, checkout, purchase) so a founder can look
// at PostHog and see WHAT converts and WHY people drop off.
//
// Localhost is skipped so dev clicks don't burn the free-tier
// event quota or clutter the real dashboard.
// ============================================================

import posthog from 'posthog-js'

const KEY  = import.meta.env.VITE_POSTHOG_KEY
const HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

let ready = false

export function initAnalytics() {
  if (ready) return
  if (!KEY) return                                // env not set — no-op
  if (typeof window === 'undefined') return
  const host = window.location.hostname
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')
  if (isLocal && import.meta.env.DEV) return      // skip dev localhost

  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: 'identified_only',           // don't create anon profiles until we identify a real user
    autocapture: true,
    capture_pageview: true,
    capture_pageleave: true,
    session_recording: {
      // Mask sensitive form inputs by default. Payment fields never
      // enter our DOM (Dodo hosts checkout) so this is defence-in-depth.
      maskAllInputs: false,
      maskInputOptions: { password: true },
    },
    // Auto-record everyone (5K free / month cap is generous for launch)
    disable_session_recording: false,
    loaded: (ph) => {
      // Debug tag helps filter events by build
      ph.register({ cue_build: 'production' })
    },
  })
  ready = true
}

// Attach a Clerk user_id + email once they sign in. This binds every
// event before + after sign-in into one profile.
export function identify(clerkUser) {
  if (!ready || !clerkUser?.id) return
  posthog.identify(clerkUser.id, {
    email:      clerkUser.primaryEmailAddress?.emailAddress
             || clerkUser.emailAddresses?.[0]?.emailAddress
             || undefined,
    name:       clerkUser.fullName || undefined,
    signed_up_at: clerkUser.createdAt || undefined,
  })
}

// Explicit reset on sign-out so the next visitor isn't stitched to
// the previous account.
export function resetAnalytics() {
  if (!ready) return
  try { posthog.reset() } catch { /* noop */ }
}

// Named events — call these at critical funnel points. Wrapped so
// callers don't need to null-check `ready`.
export function track(event, props = {}) {
  if (!ready) return
  try { posthog.capture(event, props) } catch { /* noop */ }
}

// Common event shorthands so call sites read cleanly.
export const events = {
  signInClicked:       (source)                    => track('sign_in_clicked', { source }),
  signInCompleted:     ({ method })                => track('sign_in_completed', { method }),
  promptOpened:        ({ id, title, tier })       => track('prompt_opened', { id, title, tier }),
  promptCopied:        ({ id, title, tab, tier })  => track('prompt_copied', { id, title, tab, tier }),
  dailyLimitHit:       ()                          => track('daily_limit_hit'),
  foundingCheckoutClicked: ()                      => track('founding_checkout_clicked'),
  foundingPurchaseCompleted: ({ payment_id })      => track('founding_purchase_completed', { payment_id }),
  waitlistJoined:      ({ source })                => track('waitlist_joined', { source }),
  feedbackSubmitted:   ()                          => track('feedback_submitted'),
}
