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

    // Ignore transient network / user-side errors that don't indicate
    // a real bug. These fire constantly on flaky mobile carriers and
    // just create Sentry noise. Real backend outages still surface via
    // status-code checks in individual call sites.
    ignoreErrors: [
      // Standard browser network errors during connectivity blips
      'TypeError: Failed to fetch',
      'TypeError: NetworkError when attempting to fetch resource',
      'TypeError: The Internet connection appears to be offline',
      'TypeError: Load failed',                       // Safari's fetch equivalent
      'AbortError: The user aborted a request',
      'AbortError: The operation was aborted',
      'The user aborted a request',
      'signal is aborted without reason',
      'ChunkLoadError',                                // Vite chunk load during deploy
      'ResizeObserver loop limit exceeded',            // Browser noise, not a bug
      'ResizeObserver loop completed with undelivered notifications',
      'Non-Error promise rejection captured',          // Third-party garbage
    ],
    denyUrls: [
      /extensions\//i,       // Browser extension noise
      /chrome-extension:\/\//i,
      /^moz-extension:\/\//i,
    ],

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
