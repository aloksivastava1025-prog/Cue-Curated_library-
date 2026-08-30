// ============================================================
// Cue — feature flags
// ============================================================
// One-line toggles for campaign / promo systems that come and go
// so we never have to strip and re-paste code between launches.
//
// COUPON_ENABLED — the founding-rate CUE49 hunt (welcome card,
//   hero pill live ticker, FounderDock avatar pip + code card,
//   Pricing coupon input + hint pill). Flip to true to bring the
//   entire discount narrative back; the UI, math, and Dodo hook
//   are all still wired. Also update the Dodo dashboard discount
//   code to match (see supabase/functions/create-checkout for
//   the server-side whitelist).
//
// Note: this is a JS constant read at build time. Vite inlines
// it into the bundle — no runtime env fetch, no bundle bloat.
// ============================================================

export const COUPON_ENABLED = false
