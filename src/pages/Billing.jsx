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
  const [cancelState, setCancelState] = useState('idle') // idle | confirming | cancelling | cancelled | error
  const [cancelMsg, setCancelMsg] = useState('')

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
        <a href="/" style={ctaStyle}>Back to library</a>
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

  // Monthly-subscription detection. get-my-billing returns
  // `subscription_id` + `next_billing_date` for monthly rows; lifetime
  // rows return neither. `plan_source === 'monthly:cancelling'` means
  // cancel-at-period-end is already in flight.
  const hasSubscription = !!billing?.subscription_id
  const isCancelling = billing?.plan_source === 'monthly:cancelling'
  const nextBillingRaw = billing?.next_billing_date
  const nextBillingFmt = nextBillingRaw
    ? new Date(nextBillingRaw).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
    : null

  async function handleCancel() {
    if (cancelState === 'cancelling') return
    setCancelState('cancelling')
    setCancelMsg('')
    try {
      const res = await backend.cancelSubscription(user.id)
      setCancelState('cancelled')
      setCancelMsg(res?.message || 'Cancellation scheduled — access remains active until your billing cycle ends.')
      // Reload billing to reflect the new plan_source / expires_at.
      const fresh = await backend.getMyBilling(user)
      setBilling(fresh)
    } catch (e) {
      setCancelState('error')
      setCancelMsg(e?.message || 'Could not cancel — please email hello@cuedesign.space.')
    }
  }

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
                  <a href="/pricing" style={{ fontSize: 12, color: 'var(--electric)', textDecoration: 'none' }}>Upgrade →</a>
                </>
              )}
            </span>
          } />
          <Divider />
          <Row label="Started" value={<span style={{ fontSize: 13 }}>{started}</span>} />
          {user?.primaryEmailAddress?.emailAddress && (
            <>
              <Divider />
              <Row label="Billed to" value={<span style={{ fontSize: 13 }}>{user.primaryEmailAddress.emailAddress}</span>} />
            </>
          )}
          {hasSubscription && (
            <>
              <Divider />
              <Row
                label={isCancelling ? 'Access ends' : 'Next billing date'}
                value={<span style={{ fontSize: 13 }}>{nextBillingFmt || '—'}</span>}
              />
              <Divider />
              <Row
                label="Auto-renew"
                value={
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                    <span style={{
                      display: 'inline-block', width: 8, height: 8, borderRadius: 999,
                      background: isCancelling ? '#8a8a82' : '#22c55e',
                    }} />
                    {isCancelling ? 'Cancelled — no further charge' : 'On'}
                  </span>
                }
              />
            </>
          )}
        </div>

        {/* Cancel subscription (monthly only). Cancel-at-period-end
            policy: subscription stops renewing at the next billing
            boundary; Cue+ access continues until then. */}
        {hasSubscription && (
          <div style={{ ...cardStyle, marginTop: 20 }}>
            {isCancelling ? (
              <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>
                Cancellation is scheduled. Your Cue+ access remains active until <strong style={{ color: 'var(--text)' }}>{nextBillingFmt || 'the end of your current billing cycle'}</strong>. No further charges will be made.
              </div>
            ) : cancelState === 'cancelled' ? (
              <div style={{ fontSize: 13, color: '#22c55e', lineHeight: 1.55 }}>
                {cancelMsg}
              </div>
            ) : cancelState === 'confirming' ? (
              <div>
                <div style={{ fontSize: 13, color: 'var(--text)', marginBottom: 12, lineHeight: 1.55 }}>
                  Cancel your Cue+ subscription? Access continues until <strong>{nextBillingFmt || 'the end of your current billing cycle'}</strong>. You can resubscribe any time.
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={handleCancel} disabled={cancelState === 'cancelling'} style={dangerBtn}>
                    {cancelState === 'cancelling' ? 'Cancelling…' : 'Yes, cancel at period end'}
                  </button>
                  <button onClick={() => { setCancelState('idle'); setCancelMsg('') }} style={ghostBtn}>
                    Keep subscription
                  </button>
                </div>
                {cancelState === 'error' && (
                  <div style={{ marginTop: 10, fontSize: 12, color: '#ff6b6b' }}>{cancelMsg}</div>
                )}
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.5, flex: 1, minWidth: 220 }}>
                  Cancel anytime. Access remains active until the end of your current billing cycle.
                </div>
                <button onClick={() => setCancelState('confirming')} style={ghostBtn}>
                  Cancel subscription
                </button>
              </div>
            )}
          </div>
        )}

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

        {isCuePlus && <ExportLibrarySection />}

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 32, gap: 12, flexWrap: 'wrap' }}>
          <a href="/" style={ctaStyle}>Back to library</a>
          <a href="/contact" style={{ ...ctaStyle, background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)' }}>
            Contact support
          </a>
        </div>
      </div>
    </Shell>
  )
}

// ---------- EXPORT LIBRARY ----------------------------------------
// Your-data-is-yours guarantee: every Cue+ member can walk away with
// the full library as a spreadsheet (CSV) or a machine-readable
// archive (JSON). Runs client-side — no server call besides the
// two Supabase reads, so it works even if we ever go into wind-down.

function csvEscape(v) {
  if (v == null) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function todayStamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function ExportLibrarySection() {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [lastCount, setLastCount] = useState(null)

  const doExport = async (fmt) => {
    setBusy(true); setErr('')
    try {
      const rows = await backend.exportEverythingForMe()
      setLastCount(rows.length)
      if (fmt === 'json') {
        downloadBlob(
          `cue-library-${todayStamp()}.json`,
          JSON.stringify({ exported_at: new Date().toISOString(), row_count: rows.length, rows }, null, 2),
          'application/json'
        )
        return
      }
      if (fmt === 'zip') {
        // Per-component folders with README.md + prompt.md + code.tsx.
        // Devs drop this into their AI IDE (Cursor / Claude Code /
        // Windsurf) and start shipping immediately. Media thumbnails
        // are referenced as URLs (not embedded) to keep the archive
        // small — text/code, which is what matters, ships fully.
        const JSZipModule = await import('jszip')
        const JSZip = JSZipModule.default || JSZipModule
        const zip = new JSZip()
        const root = zip.folder(`cue-library-${todayStamp()}`)
        for (const r of rows) {
          const slug = (r.id || 'component').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()
          const titleSlug = (r.title || '').replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 40).replace(/^-|-$/g, '')
          const dir = root.folder(titleSlug ? `${slug}-${titleSlug}` : slug)
          const tags = Array.isArray(r.tags) ? r.tags.join(', ') : ''
          const readme = [
            `# ${r.title || r.id}`,
            '',
            r.description || '',
            '',
            `- **ID:** ${r.id}`,
            `- **Category:** ${r.category || '—'}`,
            `- **Tier:** ${r.tier}`,
            `- **Tags:** ${tags || '—'}`,
            r.sourceCredit ? `- **Source:** ${r.sourceCredit}` : null,
            '',
            '## Preview',
            '',
            r.thumbSrc ? `![${r.title || r.id}](${r.thumbSrc})` : '_No thumbnail_',
            '',
            r.hoverSrc ? `Live preview / hover: ${r.hoverSrc}` : '',
          ].filter(Boolean).join('\n')
          dir.file('README.md', readme)
          if (r.prompt) dir.file('prompt.md', String(r.prompt))
          if (r.code)   dir.file('code.tsx',  String(r.code))
        }
        // Top-level manifest so users can grep by title/id quickly.
        root.file('MANIFEST.json', JSON.stringify({
          exported_at: new Date().toISOString(),
          row_count: rows.length,
          components: rows.map((r) => ({ id: r.id, title: r.title, category: r.category, tier: r.tier, tags: r.tags })),
        }, null, 2))
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
        downloadBlob(`cue-library-${todayStamp()}.zip`, blob, 'application/zip')
        return
      }
      // CSV — fixed column order so the file is stable across dumps.
      const cols = [
        'id', 'title', 'description', 'category', 'tags', 'tier',
        'thumbSrc', 'hoverSrc', 'sourceCredit', 'viewCount', 'likeCount',
        'code', 'prompt',
      ]
      const header = cols.join(',')
      const body = rows.map((r) => cols.map((c) => {
        const v = r[c]
        if (Array.isArray(v)) return csvEscape(v.join('|'))
        return csvEscape(v)
      }).join(',')).join('\n')
      downloadBlob(`cue-library-${todayStamp()}.csv`, header + '\n' + body + '\n', 'text/csv;charset=utf-8')
    } catch (e) {
      setErr(e?.message || 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div style={sectionHeadingStyle}>Your library</div>
      <div style={cardStyle}>
        <div style={{ padding: '14px 0', fontSize: 13, color: 'var(--text)', lineHeight: 1.55 }}>
          Every component you have access to, in one download. Includes the prompt text, tags, description, and (where available) React source code — pick the format that fits how you build.
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '0 0 14px' }}>
          <button
            type="button"
            disabled={busy}
            onClick={() => doExport('zip')}
            style={{ ...ctaStyle, padding: '10px 16px', fontSize: 13, opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer' }}
            title="Download as ZIP — one folder per component with README + prompt + code. Drop into Cursor / Claude Code."
          >
            {busy ? 'Preparing…' : 'Export as ZIP'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => doExport('csv')}
            style={{ ...ctaStyle, padding: '10px 16px', fontSize: 13, background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer' }}
            title="Download as CSV — open in Excel / Sheets / Numbers"
          >
            {busy ? 'Preparing…' : 'Export as CSV'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => doExport('json')}
            style={{ ...ctaStyle, padding: '10px 16px', fontSize: 13, background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', opacity: busy ? 0.6 : 1, cursor: busy ? 'wait' : 'pointer' }}
            title="Download as JSON — full field fidelity for AI / code use"
          >
            {busy ? 'Preparing…' : 'Export as JSON'}
          </button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-dim)', paddingBottom: 12, lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--text)' }}>ZIP</strong> — one folder per component with <code>README.md</code>, <code>prompt.md</code>, and <code>code.tsx</code>. Best for Cursor / Claude Code / Windsurf. &nbsp;·&nbsp; <strong style={{ color: 'var(--text)' }}>CSV</strong> — spreadsheet view. &nbsp;·&nbsp; <strong style={{ color: 'var(--text)' }}>JSON</strong> — full field fidelity.
        </div>
        {lastCount != null && !err && (
          <div style={{ fontSize: 12, color: 'var(--text-dim)', paddingBottom: 14 }}>
            ✓ Exported {lastCount} components.
          </div>
        )}
        {err && (
          <div style={{ fontSize: 12, color: '#ff6b6b', paddingBottom: 14 }}>
            {err}
          </div>
        )}
      </div>
    </>
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
  background: 'transparent',
  cursor: 'pointer',
  fontFamily: 'inherit',
  textDecoration: 'none',
  whiteSpace: 'nowrap',
}
const dangerBtn = {
  fontSize: 12,
  padding: '8px 14px',
  borderRadius: 999,
  border: '1px solid #ff4d6d',
  background: 'rgba(255,77,109,0.10)',
  color: '#ff4d6d',
  cursor: 'pointer',
  fontFamily: 'inherit',
  whiteSpace: 'nowrap',
  fontWeight: 500,
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
          import('../lib/analytics.js').then(({ events }) =>
            events.foundingPurchaseCompleted({ payment_id: invoice?.paymentId })
          )
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
            <a href="/" style={ctaStyle}>Start exploring →</a>
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
            email <a href={`mailto:hello@cuedesign.space?subject=${encodeURIComponent('Invoice request — ' + (invoice?.paymentId || ''))}`} style={{ color: 'var(--electric)' }}>hello@cuedesign.space</a> with your payment ID {invoice?.paymentId ? <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 6px', borderRadius: 3 }}>{invoice.paymentId}</code> : ''} and we'll send it manually.
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
            If it takes more than 10 minutes, email <a href="mailto:hello@cuedesign.space" style={{ color: 'var(--electric)' }}>hello@cuedesign.space</a> with your Dodo receipt — we'll fix it manually within an hour.
          </Body>
          <a href="/" style={ctaStyle}>Back to library</a>
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
      <a href="/pricing" style={ctaStyle}>Back to pricing</a>
    </Shell>
  )
}

// ---------- Shared pieces ------------------------------------------

function Shell({ children }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      <nav style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
        <a href="/" style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 22, color: 'var(--text)', textDecoration: 'none', letterSpacing: '-0.01em' }}>Cue<span style={{ color: 'var(--electric)' }}>.</span></a>
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
