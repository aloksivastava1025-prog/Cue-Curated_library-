import React, { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import CueUserMenu from '../components/CueUserMenu.jsx'
import { backend } from '../lib/backend.js'
import { friendlyError } from '../lib/friendlyError.js'
import { useAuth } from '../hooks/useAuth.jsx'
import Footer from '../components/Footer.jsx'
import MonthlyWaitlistModal from '../components/MonthlyWaitlistModal.jsx'
import CustomPackModal from '../components/CustomPackModal.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { COUPON_ENABLED } from '../lib/features.js'
import '../styles/overhaul.css'

/**
 * CUE — Pricing page (v5, blueprint aesthetic, dark).
 * Layout inspired by architectural blueprint: dashed grid lines, corner
 * crosshairs, diagonal hatch background around a centered content plate.
 * Adapted to CUE's dark editorial palette.
 */

const FOUNDING_CAP = 50

// Reference font: Inter 400 — regular weight, no bold anywhere in pricing.
const INTER = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"

const displayStyle = {
  fontFamily: INTER,
  fontWeight: 400,
  letterSpacing: '-0.04em',
  lineHeight: 1.1,
}
const priceStyle = {
  fontFamily: INTER,
  fontWeight: 400,
  letterSpacing: '-0.03em',
  lineHeight: 1,
}

const LINE = 'rgba(255,255,255,0.14)'   // dashed grid line
const CROSS = 'rgba(255,255,255,0.35)'  // crosshair colour

// Checkout is created server-side via the `create-checkout` edge
// function so metadata.user_id is bound to the Clerk user before Dodo
// ever sees the request. This is the only attribution path that
// survives a customer typing a different email into Dodo's form.

export default function Pricing() {
  usePageMeta({
    title: 'Pricing — founding member',
    description: 'Founding 50 members. $99 lifetime. Everything Cue is and becomes.',
  })
  const { isSignedIn, user } = useUser()
  const { openAuth } = useAuth()
  const [monthlyOpen, setMonthlyOpen] = useState(false)
  const [foundingCount, setFoundingCount] = useState(0)
  const [openFaq, setOpenFaq] = useState(null)

  // Single source of truth: USD everywhere on the site. Dodo's
  // Localized Pricing (dashboard → Products) handles the actual
  // currency conversion at checkout — an Indian buyer still sees
  // the equivalent in INR + auto GST, a European buyer sees EUR +
  // VAT, etc. Removing the on-site INR toggle avoids the sticker /
  // checkout mismatch that broke a real buyer (Sarang, Sep 1 2026)
  // and cuts the currency-toggle UI + localStorage plumbing.
  const currency = 'USD'
  const P = { sym: '$', founding: '99', crossed: '249', monthly: '49', yearlyCost: '588', taxSuffix: '' }

  useEffect(() => {
    let alive = true
    backend.getFoundingCount()
      .then((n) => { if (alive) setFoundingCount(n) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const spotsLeft = Math.max(FOUNDING_CAP - foundingCount, 0)
  const foundingFilled = spotsLeft === 0

  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [monthlyBusy, setMonthlyBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  // Coupon typed by the user on-page. Dodo's hosted checkout doesn't
  // reliably surface a discount-code field, so we collect it here and
  // pre-apply it via the create-checkout body. Only whitelisted codes
  // are honoured server-side, so anything else is dropped silently.
  const [couponInput, setCouponInput] = useState('')
  const [couponApplied, setCouponApplied] = useState('')
  const [customPackOpen, setCustomPackOpen] = useState(false)

  // CUE49 target: bring the founding price down to $79 (USD) or the
  // INR equivalent. Actual number Dodo applies at checkout depends on
  // the discount configured there — keep both in sync. Amount off is
  // just the display delta. Gate the whole coupon UI on the feature
  // flag so the same code path serves campaign-on and campaign-off.
  const couponEligible = COUPON_ENABLED
  const isCue49 = couponEligible && couponApplied === 'CUE49'
  const foundingNumericForCue49 = Number(String(P.founding).replace(/,/g, '')) || 0
  // CUE49 = 20% off on Dodo. USD $99 → $79, INR ₹4,999 → ₹3,999.
  const cue49FinalPrice = P.sym === '$' ? 79 : 3999
  const cue49AmountOff = Math.max(0, foundingNumericForCue49 - cue49FinalPrice)
  const cue49Display = isCue49
    ? {
        isCue49: true,
        price: `${P.sym}${cue49FinalPrice.toLocaleString('en-US')}`,
        crossed: `${P.sym}${P.founding}`,
        offLabel: `${P.sym}${cue49AmountOff.toLocaleString('en-US')}`,
      }
    : {
        isCue49: false,
        price: `${P.sym}${P.founding}`,
        crossed: `${P.sym}${P.crossed}`,
        offLabel: `${P.sym}${Math.max(0, foundingNumericForCue49 - cue49FinalPrice).toLocaleString('en-US')}`,
      }

  // ---------- 24-hour "new-month special" mode ----------
  // Toggle inside the founding card switches between the full $99
  // (all features, MCP included) and the $79 promo (auto-applies
  // CUE49, strikes MCP). The timer counts down 24 hrs from when
  // the user first sees the pricing page; expiry lives in
  // localStorage so refreshes don't reset it. Cross tab reads the
  // same key so the countdown feels honest instead of resettable.
  const [couponMode, setCouponMode] = useState(false)
  const [promoExpiry] = useState(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem('cue.promo.newmonth.expiry')
      const parsed = raw ? parseInt(raw, 10) : NaN
      if (Number.isFinite(parsed) && parsed > Date.now()) return parsed
      const next = Date.now() + 24 * 60 * 60 * 1000
      localStorage.setItem('cue.promo.newmonth.expiry', String(next))
      return next
    } catch { return Date.now() + 24 * 60 * 60 * 1000 }
  })
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const promoMsLeft = Math.max(0, (promoExpiry || 0) - nowTick)
  const promoExpired = promoMsLeft <= 0
  const timerLabel = (() => {
    const s = Math.floor(promoMsLeft / 1000)
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const ss = s % 60
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(h)}h ${pad(m)}m ${pad(ss)}s`
  })()
  // Auto-apply / unapply CUE49 when the toggle flips
  useEffect(() => {
    if (!couponEligible) return
    if (couponMode && !promoExpired) {
      if (couponApplied !== 'CUE49') setCouponApplied('CUE49')
    } else if (couponApplied === 'CUE49') {
      setCouponApplied('')
      setCouponInput('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couponMode, promoExpired])

  async function startFoundingCheckout() {
    if (checkoutBusy) return
    setCheckoutError('')
    setCheckoutBusy(true)
    const attempt = async () => {
      import('../lib/analytics.js').then(({ events }) => events.foundingCheckoutClicked())
      const url = await backend.createFoundingCheckout(user, {
        couponCode: couponEligible ? (couponApplied || couponInput) : '',
      })
      window.location.href = url
    }
    try {
      await attempt()
    } catch (err1) {
      await new Promise((r) => setTimeout(r, 800))
      try {
        await attempt()
      } catch (err2) {
        setCheckoutError(
          friendlyError(err2 || err1, "Couldn't open checkout. Give it another tap in a moment.")
        )
        setCheckoutBusy(false)
      }
    }
  }

  // Monthly Cue+ subscription. Same edge function, different billing
  // cycle — Dodo routes it through /subscriptions and the webhook
  // grants access on subscription.active / subscription.renewed.
  async function startMonthlyCheckout() {
    if (monthlyBusy) return
    if (!isSignedIn) { openAuth('sign-up'); return }
    setCheckoutError('')
    setMonthlyBusy(true)
    try {
      const url = await backend.createFoundingCheckout(user, { billingCycle: 'monthly' })
      window.location.href = url
    } catch (err) {
      setCheckoutError(friendlyError(err, "Couldn't open checkout. Give it another tap in a moment."))
      setMonthlyBusy(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: INTER, fontWeight: 400 }}>
      {/* Nav */}
      <nav style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <a href="/" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 24, color: 'var(--text)', letterSpacing: '-0.01em' }}>Cue<span style={{ color: 'var(--electric)' }}>.</span></span>
          <span style={{
            fontSize: 9.5, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 999,
            background: 'rgba(204,255,0,0.14)', color: '#ccff00',
            border: '1px solid rgba(204,255,0,0.45)', lineHeight: 1,
          }}>Beta</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/" style={{ fontSize: 12, color: 'var(--text-dim)', textDecoration: 'none' }}>← Library</a>
          {!isSignedIn ? (
            <button
              onClick={() => openAuth('sign-in')}
              style={{ background: 'var(--electric)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 3, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
            >Sign in</button>
          ) : (
            <CueUserMenu />
          )}
        </div>
      </nav>

      {/* Header (no grid overlay — free-floating) */}
      <section style={{ padding: '96px 24px 40px', textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 12px', border: '1px solid var(--border)',
          background: '#0e0e10',
          marginBottom: 24,
        }}>
          <span style={{ width: 6, height: 6, background: 'var(--electric)' }} />
          <span style={{ fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 500 }}>
            Simple · Founding member pricing
          </span>
        </div>
        <h1 style={{
          fontFamily: INTER,
          fontWeight: 400,
          letterSpacing: '-0.04em',
          lineHeight: 1.1,
          fontSize: 'clamp(38px, 5.4vw, 60px)',
          margin: '0 0 14px 0',
          color: 'var(--text)',
        }}>
          The founders' library.
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-dim)', lineHeight: 1.6, maxWidth: 520, marginLeft: 'auto', marginRight: 'auto' }}>
          Only 50 founding members. {P.sym}{P.founding} lifetime.<br />
          After the 50 fill, {P.sym}{P.founding} is gone forever — everyone after pays {P.sym}{P.crossed}.
        </p>
        <p style={{ margin: '10px auto 0', fontSize: 12.5, color: 'var(--electric)', lineHeight: 1.5, maxWidth: 520, letterSpacing: '0.01em', fontWeight: 500 }}>
          New hand-picked components dropping every week — one purchase, every drop, forever.
        </p>
        <p style={{ margin: '8px auto 0', fontSize: 11, color: 'var(--text-dimmer)', lineHeight: 1.5, maxWidth: 520, letterSpacing: '0.01em' }}>
          Prices shown are inclusive of applicable taxes · local currency auto-selected at checkout.
        </p>

        {/* Founding counter — currency toggle removed. Site shows USD
            everywhere; Dodo's Localized Pricing converts to buyer's
            local currency (with regional tax) at checkout. */}
        <div style={{ marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 999 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: foundingFilled ? 'var(--text-dim)' : 'var(--electric)' }} />
            <span style={{ fontSize: 12, letterSpacing: '0.04em', color: 'var(--text)' }}>
              {foundingFilled
                ? 'Founding closed · Launch pricing live'
                : foundingCount === 0
                  ? `Founding launch · ${FOUNDING_CAP} lifetime seats open`
                  : `${foundingCount} of ${FOUNDING_CAP} founding spots claimed`}
            </span>
          </div>
        </div>
      </section>

      {/* Blueprint canvas — grid lines ONLY around the pricing cards */}
      <div className="cue-blueprint-canvas" style={{
        padding: '20px 24px 60px',
        backgroundImage: `repeating-linear-gradient(45deg, #0a0a0c, #0a0a0c 1px, #0d0d10 1px, #0d0d10 9px)`,
      }}>
        <div className="cue-blueprint-plate" style={{
          position: 'relative',
          maxWidth: 1080, margin: '0 auto',
          background: '#0A0A0A',
          minHeight: 620,
        }}>
          {/* Vertical dashed grid lines (4-column gutters) */}
          <GridLine v pos="0%" />
          <GridLine v pos="25%" />
          <GridLine v pos="50%" />
          <GridLine v pos="75%" />
          <GridLine v pos="100%" />

          {/* Horizontal dashed grid lines — top, mid (col-top / col-bottom split), bottom */}
          <GridLine h pos="0%" crossPositions={['0%','25%','50%','75%','100%']} />
          <GridLine h pos="380px" crossPositions={['0%','25%','50%','75%','100%']} />
          <GridLine h pos="100%" crossPositions={['0%','25%','50%','75%','100%']} />

          {/* Content grid */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            {/* Columns area */}
            <div className="cue-blueprint-cols" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>

              {/* FREE */}
              <Col
                title="Free"
                description="Browse the library. Get a taste of Cue without committing."
                price={`${P.sym}0`}
                subLine="No credit card required"
                cta={<a href="/" style={btnGhost}>Start browsing</a>}
                features={[
                  'Browse all 50+ components',
                  'Selected free components unlocked',
                  'Works with any AI agent',
                  '2 AI prompts per day',
                  'Weekly drop newsletter',
                  'Personal use only',
                ]}
              />

              {/* CUSTOM PACK — visual-picker escape hatch for the "I
                  only need 3 things" buyer. No auto payment link:
                  Alok DMs, agrees a fair price, activates the picked
                  components directly on the user's account. */}
              <Col
                title="Custom pack"
                description="Pick only what you need. We agree a fair price and activate on your account."
                price="Fair"
                priceSub="price"
                badge="À la carte"
                subLine="Best for 1–5 picks · pick 7+ and lifetime becomes the cheaper deal."
                cta={
                  <button
                    type="button"
                    onClick={() => setCustomPackOpen(true)}
                    style={btnPrimary}
                  >
                    Build a custom pack
                  </button>
                }
                features={[
                  'Pick from the whole library (visual picker)',
                  'Best for 1–5 picks · $5–15 per component',
                  'Pick 7+? Lifetime ($79 CUE49 / $99) is cheaper',
                  'DM within 24 hrs · fair price agreed with you',
                  'Payment link sent to your registered email',
                  'Once paid, components activate on your account',
                  'Commercial use — no resell / redistribution',
                ]}
                termsCopy={
                  <>
                    By requesting you accept our{' '}
                    <a href="/legal/terms"   style={termsLinkStyle}>Terms</a> &{' '}
                    <a href="/legal/license" style={termsLinkStyle}>License</a>.
                  </>
                }
              />

              {/* CUE+ FOUNDING (highlighted, center) */}
              <Col
                title="Cue+ Founding"
                description="Everything unlocked. New drops every week. Locked at the founding price for life."
                crossedPrice={cue49Display.crossed}
                price={cue49Display.price}
                priceSub={`lifetime${P.taxSuffix}`}
                badge={foundingFilled
                  ? 'Founding closed'
                  : (couponMode && !promoExpired ? `NEW MONTH · ${timerLabel}` : 'Founding pick')}
                subLine={foundingFilled
                  ? `${P.sym}${P.crossed} lifetime for everyone now`
                  : (couponMode && !promoExpired
                    ? `CUE49 auto-applied · 20% off · no MCP included`
                    : `${foundingCount} of ${FOUNDING_CAP} spots claimed · After 50, ${P.sym}${P.founding} is gone forever`)}
                highlight
                cta={
                  foundingFilled ? (
                    <span style={{ ...btnGhost, opacity: 0.55, cursor: 'not-allowed' }}>Founding closed</span>
                  ) : !isSignedIn ? (
                    <button onClick={() => openAuth('sign-up')} style={btnPrimary}>Claim founding spot</button>
                  ) : (
                    <button onClick={startFoundingCheckout} disabled={checkoutBusy} style={{ ...btnPrimary, opacity: checkoutBusy ? 0.6 : 1, cursor: checkoutBusy ? 'wait' : 'pointer' }}>{checkoutBusy ? 'Opening checkout…' : 'Claim founding spot'}</button>
                  )
                }
                extra={
                  !foundingFilled && couponEligible && !promoExpired ? (
                    <PromoToggle
                      couponMode={couponMode}
                      onChange={setCouponMode}
                      timerLabel={timerLabel}
                      fullPriceLabel={`${P.sym}${P.founding}`}
                      promoPriceLabel={`${P.sym}${cue49FinalPrice.toLocaleString('en-US')}`}
                    />
                  ) : null
                }
                features={[
                  'Full library, unlocked',
                  'Works with any AI agent',
                  'New drops every week — forever',
                  'React source code',
                  'Request any component\'s code — I ship it personally',
                  // MCP is the $99-only upsell. In CUE49 promo mode
                  // it's struck through with a "$99 ONLY" chip so the
                  // trade-off is visible on the card without a
                  // footnote. Standard mode shows it as SOON.
                  (couponMode && !promoExpired)
                    ? { text: 'MCP support', strike: true }
                    : { text: 'MCP support', soon: true },
                  'Unlimited prompts',
                  'Commercial use — no resell / redistribution',
                  'Founding badge in profile',
                ]}
                termsCopy={
                  <>
                    By claiming you agree to our{' '}
                    <a href="/legal/terms"   style={termsLinkStyle}>Terms</a> &{' '}
                    <a href="/legal/license" style={termsLinkStyle}>License</a>{' '}
                    — commercial use, no resell.
                  </>
                }
              />

              {/* MONTHLY — live subscription. Cancel-at-period-end
                  policy: subscription stops renewing; access remains
                  active until the current billing cycle ends. */}
              <Col
                title="Monthly"
                description="Try Cue without commitment. Cancel anytime — access remains active until the end of your current billing cycle."
                price={`${P.sym}${P.monthly}`}
                priceSub="/month"
                subLine={`${P.sym}${P.yearlyCost} over a year · auto-renews monthly`}
                muted
                cta={
                  <button
                    onClick={startMonthlyCheckout}
                    disabled={monthlyBusy}
                    style={{ ...btnPrimary, opacity: monthlyBusy ? 0.6 : 1, cursor: monthlyBusy ? 'wait' : 'pointer' }}
                  >
                    {monthlyBusy ? 'Opening checkout…' : 'Start monthly'}
                  </button>
                }
                features={[
                  'Full library unlocked',
                  'Works with any AI agent',
                  '15 prompt copies per month · need more? DM Alok on X',
                  'New drops every week — while active',
                  'Cancel anytime — access until cycle end',
                  'Personal + client use — no resell / redistribution',
                ]}
                termsCopy={
                  <>
                    By subscribing you accept our{' '}
                    <a href="/legal/terms"   style={termsLinkStyle}>Terms</a> &{' '}
                    <a href="/legal/license" style={termsLinkStyle}>License</a>.
                  </>
                }
              />
            </div>
          </div>
        </div>
      </div>

      {/* Founding manifesto */}
      <section style={{ padding: '80px 24px 96px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 12px',
          background: 'rgba(0,0,255,0.08)', border: '1px solid rgba(0,0,255,0.28)',
          marginBottom: 28,
        }}>
          <span style={{ width: 6, height: 6, background: 'var(--electric)' }} />
          <span style={{ fontSize: 10, letterSpacing: '0.20em', textTransform: 'uppercase', color: 'var(--text)', fontWeight: 500 }}>
            The Founding 50
          </span>
        </div>
        <h2 style={{
          fontFamily: INTER,
          fontWeight: 400,
          letterSpacing: '-0.04em', lineHeight: 1.1,
          fontSize: 'clamp(28px, 4.2vw, 48px)',
          margin: 0, color: 'var(--text)',
          maxWidth: 780, marginLeft: 'auto', marginRight: 'auto',
        }}>
          You're not just a customer.<br />You're one of the first.
        </h2>
        <p style={{ margin: '28px auto 0', maxWidth: 560, fontSize: 14, lineHeight: 1.7, color: 'var(--text-dim)' }}>
          Be one of the 50 founding members who believed in Cue before it was live.
          After the fiftieth spot fills, $99 is gone — forever. Everyone after pays $249.
          Your founding price stays with you for life.
        </p>
      </section>

      {/* Founder story */}
      <section style={{ padding: '48px 24px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ fontSize: 10.5, letterSpacing: '0.20em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 500, marginBottom: 20 }}>
          Built by
        </div>
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <img
            src="/founder.jpg"
            alt="Alok — founder, Cue"
            width={72} height={72}
            loading="lazy"
            style={{
              width: 72, height: 72, borderRadius: 999,
              objectFit: 'cover', display: 'block', flexShrink: 0,
              background: 'transparent',
            }}
          />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 18, marginBottom: 4, letterSpacing: '-0.01em' }}>Alok</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)', letterSpacing: '0.04em', marginBottom: 14 }}>
              Founder, Cue ·{' '}
              <a href="https://x.com/Alok619308" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-dim)', textDecoration: 'none', borderBottom: '1px solid rgba(255,255,255,0.16)' }}>@Alok619308</a>
            </div>
            <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.7, color: 'var(--text-dim)' }}>
              I'm building Cue in the open. Every drop, every component, every prompt — curated by hand, tested through hundreds of AI iterations, refined until it feels right.
            </p>
            <p style={{ margin: 0, fontSize: 14, lineHeight: 1.7, color: 'var(--text-dim)' }}>
              Founding members shape what gets built next. Direct feedback, real replies, no support ticket queues. This is Cue before it becomes known — and you're welcome in.
            </p>
          </div>
        </div>
      </section>

      {/* Beta note — founder-signed, sits above FAQ where a
          serious buyer is scanning for objections. Says "this is v1,
          talk to me". */}
      <section style={{ padding: '8px 24px 0', maxWidth: 720, margin: '0 auto' }}>
        <div style={{
          display: 'flex', gap: 14, alignItems: 'flex-start',
          padding: '16px 18px',
          background: 'rgba(204,255,0,0.04)',
          border: '1px solid rgba(204,255,0,0.28)',
          borderRadius: 10,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: 999, background: '#ccff00',
            marginTop: 7, flexShrink: 0,
            boxShadow: '0 0 12px rgba(204,255,0,0.6)',
          }} />
          <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>
            <strong style={{ color: '#ccff00', letterSpacing: '0.06em', fontWeight: 700, fontSize: 11, textTransform: 'uppercase' }}>
              Beta note
            </strong>
            <div style={{ marginTop: 6 }}>
              Cue is a beta — one person building, shipping weekly. If something
              feels off, a component is missing, a prompt could be better, or
              you have a genuine question — email me at{' '}
              <a href="mailto:hello@cuedesign.space?subject=Cue%20feedback" style={{ color: 'var(--electric)', textDecoration: 'none' }}>
                hello@cuedesign.space
              </a>{' '}
              and I'll answer personally. Every genuine query gets a reply.
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ padding: '32px 24px 80px', maxWidth: 720, margin: '0 auto' }}>
        <div style={{ fontSize: 10.5, letterSpacing: '0.20em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 500, marginBottom: 20 }}>
          Common questions
        </div>
        <div style={{ display: 'grid', gap: 4 }}>
          {FAQ.map((q, i) => (
            <FaqItem key={i} q={q.q} a={q.a} open={openFaq === i} onToggle={() => setOpenFaq(openFaq === i ? null : i)} />
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ padding: '48px 24px 80px', textAlign: 'center' }}>
        {!foundingFilled && (
          <>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 14, letterSpacing: '0.04em' }}>
              {foundingCount === 0
                ? `Founding launch — be founder #1 of ${FOUNDING_CAP}`
                : `${foundingCount} of ${FOUNDING_CAP} founding spots claimed`}
            </div>
            {!isSignedIn ? (
              <button onClick={() => openAuth('sign-up')} style={{ ...btnPrimary, width: 'auto', display: 'inline-block', fontSize: 14, padding: '14px 32px' }}>Claim founding spot</button>
            ) : (
              <button onClick={startFoundingCheckout} disabled={checkoutBusy} style={{ ...btnPrimary, width: 'auto', display: 'inline-block', fontSize: 14, padding: '14px 32px', opacity: checkoutBusy ? 0.6 : 1, cursor: checkoutBusy ? 'wait' : 'pointer' }}>{checkoutBusy ? 'Opening checkout…' : 'Claim founding spot'}</button>
            )}
            <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text-dim)' }}>
              14-day refund on payment errors · Founders lock {P.sym}{P.founding} forever
            </div>
            {checkoutError && (
              <div style={{
                marginTop: 14, display: 'inline-block',
                padding: '9px 14px', borderRadius: 8,
                background: 'rgba(255,107,107,0.08)',
                border: '1px solid rgba(255,107,107,0.35)',
                color: '#ff6b6b',
                fontSize: 12.5, letterSpacing: '0.01em',
                maxWidth: 420,
              }}>{checkoutError}</div>
            )}
          </>
        )}
      </section>

      <Footer />

      <MonthlyWaitlistModal open={monthlyOpen} onClose={() => setMonthlyOpen(false)} />
      <CustomPackModal open={customPackOpen} onClose={() => setCustomPackOpen(false)} />
    </div>
  )
}

function CouponHintPill({ compact = false }) {
  const [copied, setCopied] = React.useState(false)
  const copy = () => {
    try {
      navigator.clipboard?.writeText('CUE49')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {}
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: compact ? '8px 0 0' : '18px 24px 4px' }}>
      <button
        type="button"
        onClick={copy}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 12px',
          background: 'rgba(163,230,53,0.08)',
          border: '1px dashed rgba(163,230,53,0.45)',
          borderRadius: 999,
          cursor: 'pointer',
          fontFamily: 'var(--font-sans, system-ui)',
          color: 'rgba(255,255,255,0.85)',
          fontSize: 11.5, letterSpacing: '0.01em',
          whiteSpace: 'nowrap',
          maxWidth: '100%',
        }}
        title="Copy CUE49"
      >
        <span style={{
          fontFamily: 'SF Mono, ui-monospace, Menlo, monospace',
          fontWeight: 700, letterSpacing: '0.08em',
          color: '#a3e635',
        }}>CUE49</span>
        <span style={{ color: 'rgba(255,255,255,0.55)' }}>· 20% off</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: copied ? '#22c55e' : 'rgba(255,255,255,0.55)',
          marginLeft: 2,
        }} aria-hidden="true">
          {copied ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15V5a2 2 0 0 1 2-2h10" />
            </svg>
          )}
        </span>
      </button>
    </div>
  )
}

// ---------- Grid line + crosshair --------------------------------

function GridLine({ v, h, pos, crossPositions = [] }) {
  const base = {
    position: 'absolute',
    pointerEvents: 'none',
    zIndex: 3,
  }
  if (v) {
    return (
      <div style={{
        ...base,
        top: -16, bottom: -16,
        left: pos, width: 1,
        backgroundImage: `linear-gradient(to bottom, ${LINE} 50%, transparent 50%)`,
        backgroundSize: '1px 8px',
      }} />
    )
  }
  return (
    <div style={{
      ...base,
      left: -16, right: -16,
      top: pos, height: 1,
      backgroundImage: `linear-gradient(to right, ${LINE} 50%, transparent 50%)`,
      backgroundSize: '8px 1px',
    }}>
      {crossPositions.map((cp, i) => <Crosshair key={i} left={cp} />)}
    </div>
  )
}

function Crosshair({ left }) {
  return (
    <div style={{
      position: 'absolute', width: 9, height: 9,
      left, top: 0.5,
      transform: 'translate(-50%, -50%)',
      zIndex: 4, pointerEvents: 'none',
    }}>
      <span style={{ position: 'absolute', top: 4, left: 0, right: 0, height: 1, background: CROSS }} />
      <span style={{ position: 'absolute', left: 4, top: 0, bottom: 0, width: 1, background: CROSS }} />
    </div>
  )
}

// ---------- Column ------------------------------------------------

function PromoToggle({ couponMode, onChange, timerLabel, fullPriceLabel, promoPriceLabel }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'stretch',
    }}>
      {/* Toggle row — Standard $99  |  $79 24hr special (same access) */}
      <div
        role="radiogroup"
        aria-label="Choose founding rate"
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)', borderRadius: 8,
          padding: 3, gap: 3,
        }}
      >
        <button
          type="button"
          role="radio"
          aria-checked={!couponMode}
          onClick={() => onChange(false)}
          style={{
            padding: '9px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: !couponMode ? 'var(--text)' : 'transparent',
            color: !couponMode ? 'var(--bg)' : 'var(--text)',
            fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
            letterSpacing: '-0.005em', lineHeight: 1.3,
          }}
        >
          <div>{fullPriceLabel} · with MCP</div>
          <div style={{ fontSize: 9.5, opacity: 0.65, marginTop: 2, letterSpacing: '0.04em' }}>Full lifetime</div>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={couponMode}
          onClick={() => onChange(true)}
          style={{
            padding: '9px 8px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: couponMode ? 'var(--electric)' : 'transparent',
            color: couponMode ? '#fff' : 'var(--text)',
            fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600,
            letterSpacing: '-0.005em', lineHeight: 1.3,
          }}
        >
          <div>{promoPriceLabel} · no MCP</div>
          <div style={{ fontSize: 9.5, opacity: 0.75, marginTop: 2, letterSpacing: '0.04em' }}>24-hr special</div>
        </button>
      </div>

    </div>
  )
}

const termsLinkStyle = {
  color: 'var(--text)',
  textDecoration: 'underline',
  textDecorationColor: 'rgba(255,255,255,0.35)',
  textUnderlineOffset: 2,
}

function Col({
  title, description, price, priceSub, crossedPrice, subLine,
  cta, extra, badge, highlight, muted, features = [], termsCopy,
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      opacity: muted ? 0.85 : 1,
      background: highlight ? 'rgba(0,0,255,0.04)' : 'transparent',
    }}>
      {/* Top block — FIXED height so CTAs align across all three columns */}
      <div className="cue-col-top" style={{ padding: 40, display: 'flex', flexDirection: 'column', height: 380, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 12 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 500, color: 'var(--text)' }}>{title}</h3>
          {badge && (
            <span style={{
              padding: '4px 8px',
              background: 'rgba(0,0,255,0.18)',
              color: '#fff', border: '1px solid rgba(0,0,255,0.4)',
              fontSize: 9.5, fontWeight: 500, letterSpacing: '0.06em', textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>{badge}</span>
          )}
        </div>
        {description && (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.55 }}>{description}</p>
        )}

        <div style={{ margin: '24px 0 8px', display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          {crossedPrice && (
            <span style={{
              ...priceStyle, fontSize: 22, color: 'var(--text-dim)',
              textDecoration: 'line-through', opacity: 0.55,
            }}>{crossedPrice}</span>
          )}
          <span style={{ ...priceStyle, fontSize: 48, color: 'var(--text)' }}>{price}</span>
          {priceSub && <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{priceSub}</span>}
        </div>

        {/* Always render the sub-line slot with a fixed height so the CTA
            aligns horizontally across all three columns even when one
            card's sub-line wraps to two lines. */}
        <div style={{
          fontSize: 12, color: 'var(--text-dim)',
          marginBottom: 12, lineHeight: 1.5,
          height: 40, overflow: 'hidden',
        }}>
          {subLine || ''}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 20 }}>{cta}</div>
      </div>

      {/* Optional extra slot — sits BELOW the fixed-height top block
          so the primary CTA button stays aligned horizontally across
          every card. Founding uses this to hang the coupon input +
          "Use code CUE49" pill under its button without pushing the
          button up. */}
      {extra && (
        <div style={{ padding: '0 40px 20px', boxSizing: 'border-box' }}>
          {extra}
        </div>
      )}

      {/* Click-wrap terms microcopy — its own slot outside the
          fixed-height top block so the copy never bleeds into the
          features list below. */}
      {termsCopy && (
        <div style={{
          padding: '0 40px 16px',
          fontSize: 10.5, lineHeight: 1.5,
          color: 'var(--text-dim)', textAlign: 'center',
          boxSizing: 'border-box',
        }}>
          {termsCopy}
        </div>
      )}

      {/* Bottom block — features list, fixed min height for consistent bottom edge */}
      <div className="cue-col-bottom" style={{ padding: 40, minHeight: 240, borderTop: `1px dashed ${LINE}`, boxSizing: 'border-box' }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {features.map((f, i) => {
            const isObj = typeof f === 'object'
            const text = isObj ? f.text : f
            const soon = isObj && f.soon
            const strike = isObj && f.strike
            return (
              <li key={i} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                fontSize: 13, color: strike ? 'var(--text-dim)' : 'var(--text)',
                lineHeight: 1.2, opacity: strike ? 0.5 : 1,
              }}>
                {strike ? (
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="var(--text-dim)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke={highlight ? 'var(--electric)' : 'var(--text-dim)'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                <span style={{ textDecoration: strike ? 'line-through' : 'none' }}>
                  {text}
                  {soon && !strike && (
                    <span style={{
                      marginLeft: 6, padding: '1px 6px',
                      background: 'rgba(204,255,0,0.10)', border: '1px solid rgba(204,255,0,0.28)',
                      color: '#ccff00', fontSize: 9, fontWeight: 500, letterSpacing: '0.08em',
                    }}>SOON</span>
                  )}
                  {strike && (
                    <span style={{
                      marginLeft: 6, padding: '1px 6px',
                      background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                      color: 'var(--text-dim)', fontSize: 9, fontWeight: 500, letterSpacing: '0.08em',
                    }}>$99 ONLY</span>
                  )}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

// ---------- FAQ ---------------------------------------------------

function FaqItem({ q, a, open, onToggle }) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button onClick={onToggle} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 4px', background: 'transparent', border: 'none',
        color: 'var(--text)', fontSize: 14.5, textAlign: 'left', cursor: 'pointer',
        fontFamily: 'var(--font-sans)', letterSpacing: '-0.005em',
      }}>
        <span>{q}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s ease', color: 'var(--text-dim)' }}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div style={{ padding: '0 4px 18px', fontSize: 13.5, lineHeight: 1.7, color: 'var(--text-dim)', whiteSpace: 'pre-wrap' }}>{a}</div>
      )}
    </div>
  )
}

// ---------- Static content ----------------------------------------

const FAQ = [
  { q: 'How do I know Cue is worth it?', a: "Don't take my word — open the library and browse. Every component is right there, previewable in real motion, before you spend a rupee. If the quality doesn't hit, walk away. If it does, that's the whole pitch. I'm Alok — I built Cue solo, I run the library, the code, the DMs, the drops. If something breaks, you get me directly. Reply time on X and email is usually under 6 hours." },
  { q: 'How is Cue different from every other component library?', a: "Most libraries optimise for coverage — a button of every shape, a card of every colour, thousands of contributors uploading whatever they built. Cue optimises for the opposite: only components that could earn a spot on Awwwards Site of the Day, make an X timeline stop, or ship on a landing page that converts. Every hero, every scroll-pin, every micro-interaction from A to Z is picked against a specific reference — a live Awwwards winner, a viral X interaction, a production app that got the details right. This library is for builders who obsess over the frame-perfect entry animation, the button state that earns the click, the scroll-linked detail that turns average into memorable. Cue does not sit next to other libraries — it stands alone in that lane." },
  { q: 'What is actually inside Cue right now?', a: "75+ components live today, hand-picked from Awwwards Site of the Day winners, viral X interactions, and production apps that shipped it best. Every one comes with an AI prompt tuned across ~50 iterations so you land on the version worth shipping, not iteration one. React source code and MCP support are rolling out across the top items — free for Cue+ members as they land." },
  { q: 'What is coming next for founding members?', a: "The pace is deliberate and aggressive — every drop pushes the bar higher than the last. Roadmap I am actively shipping, all free for founding members:\n\n• MCP support — Cue accessible directly inside Cursor, Claude Desktop, and every MCP-aware AI tool. Ask 'Cue, give me a cinematic hero' — get the prompt and code without leaving your editor.\n• 100+ components soon — 5 to 10 curated additions every week, hand-picked from the newest Awwwards winners and X interactions the timeline was talking about that day.\n• React source for every premium component — copy-paste-ready code, not just prompts.\n• Framer Code Component export — drop any Cue component straight into your Framer canvas.\n• Composition recipes — full page flows (hero + features + pricing + footer) shipped as one cohesive drop, not stitched together.\n• Team-shared workspaces for agency founding members.\n• Cue Series — themed drops (Text Series, Button Series, Preloader Series) where 12 components ship as one cinematic set.\n\nAnd honestly — a lot of what is coming, you cannot picture yet from where the library is today. The founding pass locks all of it in for zero extra cost. That is the deal." },
  { q: 'Everyone can prompt an AI. Why pay $99 for prompts?', a: "AI writes generic. The gap between 'a hero section' and 'a hero section that feels like the Awwwards site of the day' isn't a prompt-length problem — it's a taste problem. Every Cue prompt is the result of 30–80 iterations against reference sites until the output matches. You get iteration 42, not iteration one. That's the shortcut you're buying." },
  { q: 'Why lifetime and not a subscription?', a: "Cue isn't a service you keep logging into. You copy a prompt, ship, close the tab. Charging you every month for something you touch twice a week feels dishonest. Pay once, own it. Every future drop lands in your account automatically." },
  { q: 'What if I don\'t like it?', a: "Full refund within 24 hours if you haven't copied any premium prompts — no questions, one email to hello@cuedesign.space. Payment errors (double charge, failed provisioning) refunded within 3 business days. The full policy is on the Refund page — plain English, no fine print." },
  { q: 'Do you offer a free trial?', a: "No time-limited trial — if I unlock everything for 7 days, the whole library gets scraped in one session and there's nothing left to sell. Instead, 30+ premium components are already open on cuedesign.space with full prompt and code. No signup, no paywall. Use those as the trial. Ship one, then decide. If the quality doesn't hit the bar, don't upgrade." },
  { q: 'Can I use these in Framer, Bolt, v0, Cursor, or Claude?', a: "Yes — every prompt is tool-agnostic. Paste into Framer AI, Bolt, v0, Cursor's chat, ChatGPT, Claude — same result. Once React source ships for a component, drop it straight into Framer via Insert → Code Component, or paste into Cursor as a starting file. If a specific component's code isn't public yet, DM me — I hand-ship it for founding members." },
  { q: 'Can I use these in client work?', a: "Yes. Unlimited personal and commercial projects — agency clients, freelance builds, your own SaaS. The one thing you can't do is resell Cue prompts as your own library or use them to train an AI. Full terms on the License page." },
  { q: 'What happens after the first 50 founding spots fill?', a: "Price jumps to $249 lifetime for everyone after. Founding members keep their $99 forever — no future increase ever applies to accounts already inside. That's why the badge in your profile matters: it's proof you were early." },
  { q: 'What if I want a component you don\'t have yet?', a: "DM me on X or email hello@cuedesign.space. Send the reference (Awwwards link, Behance URL, screenshot). If it's genuinely good, I ship it within 24 hours — with your name in the changelog. That's the founding-member deal, not a marketing line." },
  { q: 'Can I unlock any premium component for free?', a: "Yes — the community deal. Post about Cue on X, Instagram, LinkedIn, or Reddit — a genuine writeup, not a copy-paste promo, with cuedesign.space linked or tagged. If it lands 10,000+ views, impressions, or reach on any single platform, DM me the post link on X (@Alok619308) with the component ID you want. I unlock it, free. One thoughtful post, one premium component. Screenshots showing your reach move you to the front of the queue. I read every one." },
]

// ---------- Styles ------------------------------------------------

const btnPrimary = {
  width: '100%',
  padding: '12px 18px',
  background: 'var(--electric)',
  color: '#fff',
  border: 'none',
  fontSize: 13, fontWeight: 500, letterSpacing: '0.02em',
  cursor: 'pointer',
  fontFamily: INTER,
  transition: 'background 0.15s ease',
  textAlign: 'center',
  boxSizing: 'border-box',
}
const btnGhost = {
  width: '100%',
  padding: '12px 18px',
  background: 'rgba(255,255,255,0.04)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  fontSize: 13, fontWeight: 500, letterSpacing: '0.02em',
  cursor: 'pointer',
  fontFamily: INTER,
  textAlign: 'center',
  textDecoration: 'none',
  display: 'inline-block',
  boxSizing: 'border-box',
}

// Compact coupon input rendered under the founding CTA. Dodo's hosted
// checkout doesn't reliably surface a discount-code field, so we
// collect the code here and pass it through create-checkout as
// `discount_code` — Dodo applies it before rendering the payment page,
// so the user sees $49 directly.
function CouponRow({ input, applied, onInputChange, onApply, onClear }) {
  if (applied) {
    return (
      <div style={{
        marginTop: 10, display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 12, color: 'rgba(255,255,255,0.72)', fontFamily: INTER,
        justifyContent: 'center',
      }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 999,
          background: 'rgba(163,230,53,0.14)',
          border: '1px solid rgba(163,230,53,0.4)',
          color: '#a3e635', letterSpacing: '0.04em',
        }}>
          <span aria-hidden="true">✓</span>
          <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 600 }}>{applied}</span>
        </span>
        <button
          type="button"
          onClick={onClear}
          style={{
            background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)',
            fontSize: 11, cursor: 'pointer', padding: 4, letterSpacing: '0.02em',
            textDecoration: 'underline',
          }}
        >remove</button>
      </div>
    )
  }
  return (
    <div style={{
      marginTop: 10, display: 'flex', alignItems: 'center', gap: 6,
      justifyContent: 'center',
    }}>
      <input
        type="text"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onApply() } }}
        placeholder="Got a coupon?"
        maxLength={20}
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.14)',
          color: '#fff',
          fontSize: 12, letterSpacing: '0.04em',
          padding: '7px 12px',
          borderRadius: 8,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          width: 130, outline: 'none',
          textTransform: 'uppercase',
        }}
      />
      <button
        type="button"
        onClick={onApply}
        disabled={!input.trim()}
        style={{
          background: 'transparent',
          border: '1px solid rgba(255,255,255,0.2)',
          color: input.trim() ? '#fff' : 'rgba(255,255,255,0.35)',
          fontSize: 12, padding: '7px 12px', borderRadius: 8,
          cursor: input.trim() ? 'pointer' : 'not-allowed',
          fontFamily: INTER, letterSpacing: '0.02em',
        }}
      >Apply</button>
    </div>
  )
}
