import React, { useState } from 'react'
import { backend } from '../lib/backend.js'
import { friendlyError } from '../lib/friendlyError.js'

/**
 * Newsletter opt-in inline form ("Get new drops in your inbox").
 * States: idle → submitting → success (or error, inline).
 * Handled gracefully:
 *  - Duplicate email: treated as success ("You're already subscribed")
 *  - Missing table: friendly message
 *  - Empty / invalid: local validation before hitting Supabase
 *
 * Reuses the same waitlist_emails table under the hood — the positioning
 * shift is UX only. When Cue+ paid tier is closer to launch, this same
 * infrastructure can flip back to a scarcity-based "reserve founding
 * access" CTA.
 */
export default function WaitlistCTA({ source = 'newsletter-hero' }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle') // 'idle' | 'submitting' | 'success' | 'error'
  const [msg, setMsg] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    if (state === 'submitting') return
    setState('submitting')
    setMsg('')
    try {
      const res = await backend.subscribeWaitlist(email, source)
      setState('success')
      setMsg(res?.alreadyOnList
        ? "You're already subscribed — we'll email you on the next drop."
        : "Subscribed. We'll email you when the next components ship.")
    } catch (err) {
      setState('error')
      setMsg(friendlyError(err, "Couldn't subscribe just now. Tap again in a moment."))
    }
  }

  if (state === 'success') {
    return (
      <div style={{
        maxWidth: 460,
        margin: '32px auto 0',
        padding: '18px 22px',
        border: '1px solid rgba(204, 255, 0, 0.35)',
        background: 'rgba(204, 255, 0, 0.06)',
        borderRadius: 999,
        color: 'var(--text)',
        fontSize: 14,
        lineHeight: 1.4,
        textAlign: 'center',
      }}>
        <span style={{ color: '#ccff00', fontWeight: 700, marginRight: 8 }}>✓</span>
        {msg}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 460, margin: '32px auto 0', textAlign: 'center' }}>
      <form
        onSubmit={submit}
        className="cue-waitlist-form"
        style={{
          display: 'flex',
          gap: 8,
          padding: 6,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)',
          borderRadius: 999,
        }}
      >
        <input
          type="email"
          required
          placeholder="you@studio.com"
          value={email}
          onChange={(e) => { setEmail(e.target.value); if (state === 'error') { setState('idle'); setMsg('') } }}
          disabled={state === 'submitting'}
          style={{
            flex: 1,
            minWidth: 0,
            padding: '10px 16px',
            background: 'transparent',
            border: 'none',
            color: 'var(--text)',
            fontSize: 14,
            fontFamily: 'var(--font-sans)',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          disabled={state === 'submitting' || !email.trim()}
          style={{
            padding: '10px 22px',
            background: state === 'submitting' ? '#1c1c1e' : 'var(--electric)',
            color: '#fff',
            border: 'none',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'var(--font-sans)',
            cursor: state === 'submitting' ? 'wait' : 'pointer',
            whiteSpace: 'nowrap',
            transition: 'background 0.2s ease, transform 0.15s ease',
          }}
        >
          {state === 'submitting' ? 'Subscribing…' : 'Get drops'}
        </button>
      </form>
      <div style={{ marginTop: 10, fontSize: 11, color: 'var(--text-dimmer)', letterSpacing: '0.02em' }}>
        Email me when new components ship. No spam, unsubscribe anytime.
      </div>
      {state === 'error' && (
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--danger)', lineHeight: 1.4 }}>
          {msg}
        </div>
      )}

      <style>{`
        .cue-waitlist-form:focus-within {
          border-color: rgba(0,0,255,0.5);
          background: rgba(0,0,255,0.04);
        }
      `}</style>
    </div>
  )
}
