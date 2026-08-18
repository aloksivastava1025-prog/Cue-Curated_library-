import React, { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { backend } from '../lib/backend.js'

/**
 * Fake-door test for the $49/mo tier. Real users, fake purchase — captures
 * intent without building a subscription pipeline. If ~20+ people join,
 * that's the signal to build monthly for real.
 */
export default function MonthlyWaitlistModal({ open, onClose }) {
  const { user, isSignedIn } = useUser()
  const clerkEmail = isSignedIn ? user?.primaryEmailAddress?.emailAddress : ''
  const [email, setEmail] = useState('')
  const [state, setState] = useState('idle') // idle | submitting | success | error | already
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    if (!open) return
    setEmail(clerkEmail || '')
    setState('idle')
    setErrMsg('')
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, clerkEmail, onClose])

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    if (state === 'submitting') return
    setState('submitting'); setErrMsg('')
    try {
      const { alreadyOnList } = await backend.joinMonthlyWaitlist({ email, source: 'pricing-monthly' })
      setState(alreadyOnList ? 'already' : 'success')
    } catch (err) {
      setState('error')
      setErrMsg(err?.message || 'Something went wrong. Try again.')
    }
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1100, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={(e) => e.stopPropagation()} data-lenis-prevent style={{
        width: '100%', maxWidth: 460, background: 'var(--card-bg)',
        borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.8)', position: 'relative',
      }}>
        <button onClick={onClose} aria-label="Close" style={{
          position: 'absolute', top: 14, right: 14, zIndex: 3,
          width: 30, height: 30, borderRadius: 999, background: 'transparent',
          color: 'var(--text-dim)', border: 'none', cursor: 'pointer',
          fontSize: 20, lineHeight: 1,
        }}>×</button>

        {state === 'success' || state === 'already' ? (
          <div style={{ padding: '48px 28px 40px', textAlign: 'center' }}>
            <div style={{
              width: 56, height: 56, borderRadius: 999, margin: '0 auto 18px',
              background: 'rgba(204,255,0,0.14)', border: '1px solid rgba(204,255,0,0.45)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: '#ccff00', fontSize: 26,
            }}>✓</div>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 26, fontWeight: 400, margin: '0 0 8px', color: '#fff' }}>
              {state === 'already' ? "You're already on the list." : "You're on the list."}
            </h3>
            <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 13.5, lineHeight: 1.55, maxWidth: 360, marginLeft: 'auto', marginRight: 'auto' }}>
              We'll email you when the monthly plan launches. Meanwhile, founding lifetime is our recommended path — locked at $99 forever.
            </p>
            <button onClick={onClose} style={{
              marginTop: 22, padding: '10px 22px',
              background: 'transparent', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 999,
              fontSize: 12.5, letterSpacing: '0.04em', cursor: 'pointer',
            }}>Close</button>
          </div>
        ) : (
          <form onSubmit={submit} style={{ padding: 28 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--electric)', fontWeight: 700, marginBottom: 6 }}>
                Monthly plan · $49/mo
              </div>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 26, fontWeight: 400, margin: 0, color: '#fff', letterSpacing: '-0.015em' }}>
                Get notified when it launches.
              </h3>
              <p style={{ margin: '8px 0 0', color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.55 }}>
                Monthly launches after beta. Right now, the founding lifetime tier is the best path — locked at $99 forever.
              </p>
            </div>

            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@studio.com"
              required
              style={{
                width: '100%', padding: '12px 14px',
                background: '#0b0b0d', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 8,
                fontFamily: 'var(--font-sans)', fontSize: 13, outline: 'none',
              }}
            />

            <button
              type="submit"
              disabled={state === 'submitting'}
              style={{
                width: '100%', marginTop: 12,
                padding: '12px 16px',
                background: state === 'submitting' ? '#1c1c1e' : 'var(--electric)',
                color: state === 'submitting' ? 'var(--text-dimmer)' : '#fff',
                border: 'none', borderRadius: 8,
                fontSize: 13.5, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {state === 'submitting' ? 'Adding…' : 'Notify me'}
            </button>

            {state === 'error' && (
              <div style={{
                marginTop: 10, padding: '10px 12px',
                background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.28)',
                borderRadius: 6, fontSize: 12.5, color: 'var(--danger)', lineHeight: 1.4,
              }}>{errMsg}</div>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
