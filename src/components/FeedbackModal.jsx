import React, { useState, useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import { backend } from '../lib/backend.js'

/**
 * Feedback modal — dual-purpose text box:
 *   - Suggest improvements
 *   - Request specific components
 * Opens on any click of `<FeedbackTrigger>` (rendered separately).
 * Optional email; anonymous OK.
 */
export default function FeedbackModal({ open, onClose, source }) {
  const [kind, setKind] = useState('improvement') // 'improvement' | 'component_request'
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle') // 'idle' | 'submitting' | 'success' | 'error'
  const [errorMsg, setErrorMsg] = useState('')
  const { user, isSignedIn } = useUser()
  const clerkEmail = isSignedIn ? user?.primaryEmailAddress?.emailAddress : ''

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      setKind('improvement')
      setMessage('')
      setEmail(clerkEmail || '')
      setState('idle')
      setErrorMsg('')
    }
  }, [open, clerkEmail])

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    if (state === 'submitting') return
    setState('submitting')
    setErrorMsg('')
    try {
      await backend.submitFeedback({ kind, message, email, source })
      setState('success')
    } catch (err) {
      setState('error')
      setErrorMsg(err?.message || 'Something went wrong. Try again.')
    }
  }

  const kindLabel = kind === 'component_request' ? 'component request' : 'suggestion'
  const placeholder = kind === 'component_request'
    ? "e.g. Split-scroll hero with pinned text and a WebGL image reveal — I'd use it on a photography portfolio."
    : "e.g. Cards jitter slightly when I scroll fast. Also, saved items would help me come back for the ones I liked."

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1100,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-lenis-prevent
        style={{
          width: '100%', maxWidth: 520,
          background: 'var(--card-bg)',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
          position: 'relative',
          border: '1px solid var(--border)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 14, right: 14, zIndex: 3,
            width: 30, height: 30, borderRadius: 999,
            background: 'transparent', color: 'var(--text-dim)', border: 'none',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            fontSize: 20, lineHeight: 1,
          }}
        >×</button>

        {state === 'success' ? (
          <div style={{ padding: '48px 28px 40px', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 999, margin: '0 auto 18px',
              background: 'rgba(204,255,0,0.14)', border: '1px solid rgba(204,255,0,0.45)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: '#ccff00', fontSize: 26, lineHeight: 1,
            }}>✓</div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontStyle: 'italic', fontWeight: 400, margin: '0 0 8px', color: '#fff' }}>
              Thanks — got it.
            </h3>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13.5, lineHeight: 1.55, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
              Your {kindLabel} is in. We read every one. If you left an email we'll follow up when there's news.
            </p>
            <button
              onClick={onClose}
              style={{
                marginTop: 22, padding: '10px 22px',
                background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 999,
                fontSize: 12.5, letterSpacing: '0.04em', cursor: 'pointer',
              }}
            >Close</button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ padding: '28px' }}>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--electric)', fontWeight: 700, marginBottom: 6 }}>
                Feedback
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 26, fontStyle: 'italic', fontWeight: 400, margin: 0, letterSpacing: '-0.015em', color: '#fff' }}>
                Tell us what's next
              </h3>
              <p style={{ margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.5 }}>
                Suggest an improvement or request a component you wish CUE had.
              </p>
            </div>

            {/* Kind toggle */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
              {[
                { key: 'improvement', label: 'Suggest improvement' },
                { key: 'component_request', label: 'Request component' },
              ].map((t) => {
                const on = kind === t.key
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setKind(t.key)}
                    style={{
                      padding: '10px 12px',
                      background: on ? 'rgba(0,0,255,0.08)' : '#0e0e10',
                      border: `1px solid ${on ? 'var(--electric)' : 'var(--border)'}`,
                      color: on ? '#fff' : 'var(--text-dim)',
                      borderRadius: 8,
                      fontSize: 12.5, fontWeight: 600,
                      cursor: 'pointer', textAlign: 'center',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {t.label}
                  </button>
                )
              })}
            </div>

            {/* Message */}
            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={placeholder}
              required
              data-lenis-prevent
              style={{
                width: '100%',
                padding: '12px 14px',
                background: '#0b0b0d',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontFamily: 'var(--font-sans)',
                fontSize: 13.5,
                lineHeight: 1.55,
                outline: 'none',
                resize: 'vertical',
                minHeight: 110,
              }}
            />

            {/* Email — auto-filled when signed in so we can thread replies */}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={!!clerkEmail}
              placeholder={clerkEmail ? '' : 'you@studio.com (optional — for follow-up)'}
              style={{
                width: '100%',
                marginTop: 10,
                padding: '10px 14px',
                background: '#0b0b0d',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                fontFamily: 'var(--font-sans)',
                fontSize: 12.5,
                outline: 'none',
              }}
            />

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10, marginTop: 16, alignItems: 'center' }}>
              <button
                type="submit"
                disabled={state === 'submitting' || !message.trim()}
                style={{
                  flex: 1,
                  padding: '12px 16px',
                  background: (state === 'submitting' || !message.trim()) ? '#1c1c1e' : 'var(--electric)',
                  color: (state === 'submitting' || !message.trim()) ? 'var(--text-dimmer)' : '#fff',
                  border: 'none', borderRadius: 8,
                  fontSize: 13.5, fontWeight: 600,
                  cursor: (state === 'submitting' || !message.trim()) ? 'not-allowed' : 'pointer',
                  transition: 'background 0.2s ease',
                }}
              >
                {state === 'submitting' ? 'Sending…' : 'Send'}
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '12px 18px',
                  background: 'transparent', color: 'var(--text-dim)',
                  border: '1px solid var(--border)', borderRadius: 8,
                  fontSize: 13, cursor: 'pointer',
                }}
              >Cancel</button>
            </div>

            {state === 'error' && (
              <div style={{ marginTop: 10, padding: '10px 12px', background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.28)', borderRadius: 6, fontSize: 12.5, color: 'var(--danger)', lineHeight: 1.4 }}>
                {errorMsg}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
