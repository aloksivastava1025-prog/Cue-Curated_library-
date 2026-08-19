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
  if (variant === 'cancel')  return <BillingCancel />
  if (variant === 'account') return <BillingAccount />
  return <BillingSuccess />
}

// ---------- ACCOUNT ------------------------------------------------

function BillingAccount() {
  usePageMeta({ title: 'Billing & invoices' })
  const { user, isSignedIn } = useUser()
  const [billing, setBilling] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!isSignedIn || !user?.id) { setLoading(false); return }
    let alive = true
    backend.getMyBilling(user)
      .then((b) => { if (alive) setBilling(b) })
      .catch((e) => { if (alive) setErr(e?.message || 'Could not load billing') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [isSignedIn, user?.id])

  if (!isSignedIn) {
    return (
      <Shell>
        <Eyebrow color="var(--text-dim)">Account</Eyebrow>
        <Title>Sign in to view billing.</Title>
        <a href="#/" style={ctaStyle}>Back to library</a>
      </Shell>
    )
  }

  const plan = billing?.plan || 'free'
  const isCuePlus = plan === 'cue_plus' || plan === 'cue_plus_team'
  const started = billing?.plan_started_at
    ? new Date(billing.plan_started_at).toLocaleDateString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
      })
    : '—'

  const supaBase = import.meta.env.VITE_SUPABASE_URL || ''
  const invoiceUrl = (pid) =>
    `${supaBase}/functions/v1/get-invoice?payment_id=${encodeURIComponent(pid)}`

  return (
    <Shell>
      <Eyebrow color="var(--electric)">Billing & invoices</Eyebrow>
      <div style={{ textAlign: 'left', maxWidth: 560, margin: '0 auto' }}>
        <h1 style={{
          fontFamily: 'var(--font-serif)', fontWeight: 300, fontStyle: 'italic',
          fontSize: 'clamp(36px, 6vw, 52px)', letterSpacing: '-0.03em',
          margin: '0 0 32px', lineHeight: 1.05, textAlign: 'center',
        }}>Your plan.</h1>

        {/* Plan card */}
        <div style={cardStyle}>
          <Row label="Plan" value={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              {isCuePlus ? (
                <>
                  <span style={badgeStyle('cue_plus')}>Cue+ Founding</span>
                  <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>$99 lifetime</span>
                </>
              ) : (
                <>
                  <span style={badgeStyle('free')}>Free</span>
                  <a href="#/pricing" style={{ fontSize: 12, color: 'var(--electric)', textDecoration: 'none' }}>Upgrade →</a>
                </>
              )}
            </span>
          } />
          <Divider />
          <Row label="Started" value={<span style={{ fontSize: 13 }}>{started}</span>} />
          {billing?.email && (
            <>
              <Divider />
              <Row label="Billed to" value={<span style={{ fontSize: 13 }}>{billing.email}</span>} />
            </>
          )}
        </div>

        {/* Invoice history */}
        <h2 style={sectionHeadingStyle}>Invoices</h2>
        {loading && <Meta>Loading…</Meta>}
        {!loading && err && <Meta style={{ color: '#ff6b6b' }}>{err}</Meta>}
        {!loading && !err && (!billing?.history || billing.history.length === 0) && (
          <Meta>No invoices yet.</Meta>
        )}
        {!loading && billing?.history?.length > 0 && (
          <div style={cardStyle}>
            {billing.history.map((h, i) => (
              <React.Fragment key={h.payment_id}>
                {i > 0 && <Divider />}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '12px 0' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>
                      {h.amount != null && h.currency
                        ? `${(h.amount / 100).toFixed(2)} ${h.currency}`
                        : 'Cue+ Founding'}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                      {h.at ? new Date(h.at).toLocaleString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: 'numeric', minute: '2-digit',
                      }) : ''}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-dimmer)', marginTop: 2, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {h.payment_id}
                    </div>
                  </div>
                  <a href={invoiceUrl(h.payment_id)} target="_blank" rel="noopener noreferrer" style={ghostBtn}>
                    Download PDF
                  </a>
                </div>
              </React.Fragment>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32, gap: 12, flexWrap: 'wrap' }}>
          <a href="#/" style={ctaStyle}>Back to library</a>
          <a href={`mailto:hello@usecue.com?subject=${encodeURIComponent('Billing question')}`} style={{ ...ctaStyle, background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}>
            Contact support
          </a>
        </div>
      </div>
    </Shell>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '12px 0' }}>
      <div style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div>{value}</div>
    </div>
  )
}
function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', opacity: 0.5 }} />
}
const cardStyle = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '4px 20px',
}
const sectionHeadingStyle = {
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--text-dim)',
  margin: '32px 0 12px',
}
function badgeStyle(kind) {
  const map = {
    cue_plus:  { bg: 'rgba(204,255,0,0.14)', fg: '#ccff00', bd: 'rgba(204,255,0,0.45)' },
    free:      { bg: 'rgba(255,255,255,0.06)', fg: 'var(--text)', bd: 'var(--border)' },
  }
  const c = map[kind] || map.free
  return {
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    background: c.bg,
    color: c.fg,
    border: `1px solid ${c.bd}`,
  }
}
const ghostBtn = {
  fontSize: 12,
  padding: '8px 14px',
  borderRadius: 999,
  border: '1px solid var(--border)',
  color: 'var(--text)',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
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
          <Meta>
            Dodo emails your invoice within 2–3 minutes. Not there?{' '}
            {invoice?.paymentId && <>Click <b>Download invoice</b> above, or </>}
            email <a href={`mailto:hello@usecue.com?subject=${encodeURIComponent('Invoice request — ' + (invoice?.paymentId || ''))}`} style={{ color: 'var(--electric)' }}>hello@usecue.com</a> with your payment ID {invoice?.paymentId ? <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 3 }}>{invoice.paymentId}</code> : ''} and we'll send it manually.
          </Meta>
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
