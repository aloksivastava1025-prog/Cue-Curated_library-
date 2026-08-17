import * as Sentry from '@sentry/react'

// DSN is public (safe to expose in the bundle, same as a Clerk publishable
// key). Kept in an env var so prod / dev can use different projects later.
const DSN = import.meta.env.VITE_SENTRY_DSN

let initialized = false

export function initSentry() {
  if (initialized || !DSN) return
  initialized = true
  Sentry.init({
    dsn: DSN,
    environment: import.meta.env.DEV ? 'development' : 'production',
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    // Session Replay intentionally OFF — records DOM, escalating privacy surface.
    beforeSend(event) {
      // Scrub emails + Clerk user_ids from any strings we send. India's DPDP
      // Act treats these as personal data — Sentry becomes a processor if we
      // ship them raw, which we haven't papered.
      const scrub = (s) => {
        if (typeof s !== 'string') return s
        return s
          .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '<email>')
          .replace(/user_[a-zA-Z0-9]{20,}/g, '<user_id>')
      }
      if (event.message) event.message = scrub(event.message)
      ;(event.exception?.values || []).forEach((v) => { v.value = scrub(v.value) })
      ;(event.breadcrumbs || []).forEach((b) => {
        if (b.message) b.message = scrub(b.message)
        if (b.data) {
          Object.keys(b.data).forEach((k) => {
            if (typeof b.data[k] === 'string') b.data[k] = scrub(b.data[k])
          })
        }
      })
      return event
    },
  })
}

// Re-export the API surface we actually use so callers don't need to import
// from '@sentry/react' directly.
export const captureException = (err, ctx) => Sentry.captureException(err, ctx)
export const captureMessage = (msg, level = 'info') => Sentry.captureMessage(msg, level)
export const setUser = (u) => Sentry.setUser(u)
