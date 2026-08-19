import React, { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { backend } from '../lib/backend.js'
import Footer from '../components/Footer.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'

/**
 * /billing/success and /billing/cancel landing pages.
 *
 * DESIGN NOTE — Access is granted ONLY via the Dodo webhook, never on
 * the browser redirect. This page just tells the user "we're processing"
 * and polls their user_profiles.plan for confirmation. If the webhook
 * doesn't land in ~30s we show a friendly "check back / support" state
 * rather than pretending they've been upgraded.
 */
export default function Billing({ variant = 'success' }) {
  return variant === 'cancel' ? <BillingCancel /> : <BillingSuccess />
}

// ---------- SUCCESS ------------------------------------------------

function BillingSuccess() {
  usePageMeta({ title: 'Confirming payment' })
  const { user, isSignedIn } = useUser()
  const [state, setState] = useState('polling') // polling | ready | pending | error
  const [attempts, setAttempts] = useState(0)
  const [invoice, setInvoice] = useState(null) // { paymentId, invoiceUrl }

  // Read `?payment_id=...` from Dodo's redirect so we can offer an
  // invoice download button on the success screen. Dodo appends this
  // param on hosted checkout completion.
  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const pid = url.searchParams.get('payment_id') || url.searchParams.get('paymentId')
      if (pid) setInvoice({ paymentId: pid })
    } catch {}
  }, [])

  // Poll user_profiles.plan every 2s for up to 60s.
  // The webhook usually lands within 3–10s in test mode.
  useEffect(() => {
    if (!isSignedIn || !user?.id) return
    let cancelled = false
    let tries = 0
    const MAX_TRIES = 30 // 30 × 2s = 60s

    const tick = async () => {
      if (cancelled) return
      tries++
      setAttempts(tries)
      try {
        const profile = await backend.getMyProfile(user.id)
        const plan = profile?.plan
        if (plan && plan !== 'free') {
          if (!cancelled) setState('ready')
          return
        }
      } catch { /* keep polling */ }

      // After 20s (10 ticks) still locked — call the reconciliation
      // function once. This catches payments where webhook attribution
      // failed but a matching payment_events row exists.
      if (tries === 10) {
        try { await backend.reconcile() } catch {}
      }

      if (tries >= MAX_TRIES) {
        if (!cancelled) setState('pending')
        return
      }
      setTimeout(tick, 2000)
    }
    tick()
    return () => { cancelled = true }
  }, [isSignedIn, user?.id])

  return (
    <Shell>
      <Eyebrow color="var(--electric)">Payment</Eyebrow>
      {state === 'polling' && (
        <>
          <Title>Confirming your payment…</Title>
          <Body>
            Dodo has sent us your payment. We're waiting for the confirmation
            webhook to land — usually 3–10 seconds. Please don't close this tab.
          </Body>
          <Spinner />
          <Meta>Attempt {attempts} of 30</Meta>
        </>
      )}
      {state === 'ready' && (
        <>
          <Title>Welcome to Cue+.</Title>
          <Body>
            Your founding spot is locked at $99, forever. Full library
            unlocked. All future drops included.
          </Body>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="#/" style={ctaStyle}>Start exploring →</a>
            {invoice?.paymentId && (
              <a
                href={`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-invoice?payment_id=${encodeURIComponent(invoice.paymentId)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ ...ctaStyle, background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}
              >
                Download invoice
              </a>
            )}
          </div>
          <Meta>Invoice also emailed to you.</Meta>
        </>
      )}
      {state === 'pending' && (
        <>
          <Title>Payment received — access pending.</Title>
          <Body>
            Dodo has your payment but our confirmation webhook hasn't landed
            yet. This happens rarely; access typically activates within a
            few minutes.
            <br /><br />
            If it takes more than 10 minutes, email <a href="mailto:hello@usecue.com" style={{ color: 'var(--electric)' }}>hello@usecue.com</a> with your Dodo receipt — we'll fix it manually within an hour.
          </Body>
          <a href="#/" style={ctaStyle}>Back to library</a>
        </>
      )}
      {state === 'error' && (
        <>
          <Title>Couldn't verify your account.</Title>
          <Body>Please sign in to check your subscription status.</Body>
        </>
      )}
    </Shell>
  )
}

// ---------- CANCEL -------------------------------------------------

function BillingCancel() {
  usePageMeta({ title: 'Payment cancelled' })
  return (
    <Shell>
      <Eyebrow color="var(--text-dim)">Payment cancelled</Eyebrow>
      <Title>No charge made.</Title>
      <Body>
        You closed the checkout before it completed. No card was charged
        and no email was sent. Come back when you're ready — founding
        pricing is still open.
      </Body>
      <a href="#/pricing" style={ctaStyle}>Back to pricing</a>
    </Shell>
  )
}

// ---------- Shared pieces ------------------------------------------

function Shell({ children }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
        <a href="#/" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 22, color: 'var(--text)', textDecoration: 'none' }}>CUE</a>
      </nav>
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
        <div style={{ maxWidth: 520, textAlign: 'center' }}>{children}</div>
      </main>
      <Footer />
    </div>
  )
}

function Eyebrow({ color, children }) {
  return (
    <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color, fontWeight: 700, marginBottom: 16 }}>{children}</div>
  )
}
function Title({ children }) {
  return (
    <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontStyle: 'italic', fontSize: 'clamp(40px, 7vw, 64px)', letterSpacing: '-0.03em', margin: '0 0 20px', lineHeight: 1 }}>
      {children}
    </h1>
  )
}
function Body({ children }) {
  return <p style={{ margin: '0 auto 28px', fontSize: 14.5, lineHeight: 1.7, color: 'var(--text-dim)', maxWidth: 460 }}>{children}</p>
}
function Meta({ children }) {
  return <div style={{ fontSize: 11, color: 'var(--text-dimmer)', marginTop: 12 }}>{children}</div>
}
function Spinner() {
  return (
    <div style={{
      width: 32, height: 32, margin: '10px auto',
      border: '2px solid var(--border)', borderTopColor: 'var(--electric)',
      borderRadius: 999,
      animation: 'cueSpin 900ms linear infinite',
    }}>
      <style>{`@keyframes cueSpin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
const ctaStyle = {
  display: 'inline-block',
  padding: '12px 24px',
  background: 'var(--electric)',
  color: '#fff',
  textDecoration: 'none',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 500,
  letterSpacing: '0.02em',
}
