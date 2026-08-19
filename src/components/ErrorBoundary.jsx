import React from 'react'
import { captureException } from '../lib/sentry.js'

/**
 * Catches render errors and shows a graceful CUE-branded fallback instead
 * of the crude window.onerror red overlay. In dev the raw error is shown
 * to aid debugging; in prod only the friendly message.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[CUE ErrorBoundary]', error, info)
    captureException(error, { contexts: { react: { componentStack: info?.componentStack } } })
  }
  reset = () => {
    this.setState({ error: null })
    window.location.hash = '#/'
    window.location.reload()
  }
  render() {
    if (!this.state.error) return this.props.children
    const isDev = import.meta.env?.DEV
    return (
      <div style={{
        minHeight: '100vh', background: 'var(--bg, #0A0A0A)', color: '#eee',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '48px 24px', textAlign: 'center',
      }}>
        <div style={{ maxWidth: 560 }}>
          <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#0000ff', fontWeight: 700, marginBottom: 14 }}>
            Something broke
          </div>
          <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', fontWeight: 300, fontStyle: 'italic', fontSize: 'clamp(40px, 7vw, 68px)', letterSpacing: '-0.03em', margin: '0 0 16px', lineHeight: 1 }}>
            Well, that's embarrassing.
          </h1>
          <p style={{ margin: '0 auto 28px', fontSize: 14, lineHeight: 1.55, color: '#a5a5a5', maxWidth: 440 }}>
            The library hit a bump. It's been logged. Try refreshing — if it keeps happening, drop us a note at hello@cuedesign.space.
          </p>
          <button onClick={this.reset} style={{
            padding: '12px 22px', background: '#0000ff', color: '#fff',
            border: 'none', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Reload CUE</button>
          {isDev && (
            <pre style={{
              marginTop: 24, textAlign: 'left', fontSize: 11.5, color: '#ff8080',
              background: '#111', padding: 14, borderRadius: 8, overflow: 'auto',
              maxHeight: 260, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, Menlo, monospace',
            }}>
              {String(this.state.error?.stack || this.state.error)}
            </pre>
          )}
        </div>
      </div>
    )
  }
}
