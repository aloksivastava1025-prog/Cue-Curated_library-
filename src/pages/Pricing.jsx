import React, { useEffect, useState } from 'react'
import { useUser, UserButton } from '@clerk/clerk-react'
import { backend } from '../lib/backend.js'
import { useAuth } from '../hooks/useAuth.jsx'
import Footer from '../components/Footer.jsx'
import MonthlyWaitlistModal from '../components/MonthlyWaitlistModal.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'
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
  async function startFoundingCheckout() {
    if (checkoutBusy) return
    setCheckoutBusy(true)
    try {
      // Fire the intent event BEFORE Dodo's redirect — after redirect
      // the page unloads and any post-hoc event may not flush.
      import('../lib/analytics.js').then(({ events }) => events.foundingCheckoutClicked())
      const url = await backend.createFoundingCheckout(user)
      window.location.href = url
    } catch (err) {
      alert(err?.message || 'Could not start checkout. Please try again.')
      setCheckoutBusy(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: INTER, fontWeight: 400 }}>
      {/* Nav */}
      <nav style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <a href="#/" style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, textDecoration: 'none' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 24, color: 'var(--text)' }}>CUE</span>
          <span style={{
            fontSize: 9.5, fontWeight: 500, letterSpacing: '0.16em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: 999,
            background: 'rgba(204,255,0,0.14)', color: '#ccff00',
            border: '1px solid rgba(204,255,0,0.45)', lineHeight: 1,
          }}>Beta</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="#/" style={{ fontSize: 12, color: 'var(--text-dim)', textDecoration: 'none' }}>← Library</a>
          {!isSignedIn ? (
            <button
              onClick={() => openAuth('sign-in')}
              style={{ background: 'var(--electric)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: 3, cursor: 'pointer', fontSize: 12, fontWeight: 500 }}
            >Sign in</button>
          ) : (
            <UserButton>
              <UserButton.MenuItems>
                <UserButton.Link
                  label="Billing & invoices"
                  labelIcon={<span style={{ display: 'inline-block', width: 16, height: 16 }}>▤</span>}
                  href="/#/billing"
                />
                <UserButton.Link
                  label="Contact us"
                  labelIcon={<span style={{ display: 'inline-block', width: 16, height: 16 }}>✉</span>}
                  href="/#/contact"
                />
              </UserButton.MenuItems>
            </UserButton>
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
          Only 50 founding members. $99 lifetime.<br />
          After the 50 fill, $99 is gone forever — everyone after pays $249.
        </p>

        {/* Live founding counter */}
        <div style={{ marginTop: 24, display: 'inline-flex', alignItems: 'center', gap: 12, padding: '8px 16px', border: '1px solid var(--border)', borderRadius: 999 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: foundingFilled ? 'var(--text-dim)' : 'var(--electric)' }} />
          <span style={{ fontSize: 12, letterSpacing: '0.04em', color: 'var(--text)' }}>
            {foundingFilled
              ? 'Founding closed · Launch pricing live'
              : `${foundingCount} of ${FOUNDING_CAP} founding spots claimed`}
          </span>
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
          {/* Vertical dashed grid lines (3-column gutters) */}
          <GridLine v pos="0%" />
          <GridLine v pos="33.333%" />
          <GridLine v pos="66.666%" />
          <GridLine v pos="100%" />

          {/* Horizontal dashed grid lines — top, mid (col-top / col-bottom split), bottom */}
          <GridLine h pos="0%" crossPositions={['0%','33.333%','66.666%','100%']} />
          <GridLine h pos="380px" crossPositions={['0%','33.333%','66.666%','100%']} />
          <GridLine h pos="100%" crossPositions={['0%','33.333%','66.666%','100%']} />

          {/* Content grid */}
          <div style={{ position: 'relative', zIndex: 2 }}>
            {/* Columns area */}
            <div className="cue-blueprint-cols" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>

              {/* FREE */}
              <Col
                title="Free"
                description="Browse the library. Get a taste of Cue without committing."
                price="$0"
                subLine="No credit card required"
                cta={<a href="#/" style={btnGhost}>Start browsing</a>}
                features={[
                  'Browse all 50+ components',
                  'Selected free components unlocked',
                  'Works with Framer, Bolt, v0, Cursor',
                  '2 AI prompts per day',
                  'Weekly drop newsletter',
                  'Personal use only',
                ]}
              />

              {/* CUE+ FOUNDING (highlighted, center) */}
              <Col
                title="Cue+ Founding"
                description="Everything unlocked. Locked at the founding price for life."
                crossedPrice="$249"
                price="$99"
                priceSub="lifetime"
                badge={foundingFilled ? 'Founding closed' : 'Founding pick'}
                subLine={foundingFilled
                  ? '$249 lifetime for everyone now'
                  : `${foundingCount} of ${FOUNDING_CAP} spots claimed · After 50, $99 is gone forever`}
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
                features={[
                  'Full library, unlocked',
                  'Works with Framer, Bolt, v0, Cursor',
                  'All future drops',
                  { text: 'React source code', soon: true },
                  'Request any component\'s code — I ship it personally',
                  { text: 'MCP support', soon: true },
                  'Unlimited prompts',
                  'Commercial use',
                  'Founding badge in profile',
                ]}
              />

              {/* MONTHLY (waitlist decoy) */}
              <Col
                title="Monthly"
                description="Try Cue without commitment. Cancel anytime — access ends on cancel."
                price="$49"
                priceSub="/month"
                subLine="$588 over a year · launching after beta"
                muted
                cta={<button onClick={() => setMonthlyOpen(true)} style={btnGhost}>Notify me</button>}
                features={[
                  'Full library unlocked',
                  'Works with Framer, Bolt, v0, Cursor',
                  'All future drops',
                  'Cancel anytime',
                  'Personal use only',
                  'Access ends on cancel',
                ]}
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
          <div style={{
            width: 64, height: 64, borderRadius: 999,
            background: 'linear-gradient(135deg, rgba(0,0,255,0.4), rgba(204,255,0,0.3))',
            border: '1px solid var(--border)', flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontFamily: INTER, fontWeight: 500, fontSize: 18, marginBottom: 12, letterSpacing: '-0.01em' }}>Alok</div>
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
              {foundingCount} of {FOUNDING_CAP} founding spots claimed
            </div>
            {!isSignedIn ? (
              <button onClick={() => openAuth('sign-up')} style={{ ...btnPrimary, width: 'auto', display: 'inline-block', fontSize: 14, padding: '14px 32px' }}>Claim founding spot</button>
            ) : (
              <button onClick={startFoundingCheckout} disabled={checkoutBusy} style={{ ...btnPrimary, width: 'auto', display: 'inline-block', fontSize: 14, padding: '14px 32px', opacity: checkoutBusy ? 0.6 : 1, cursor: checkoutBusy ? 'wait' : 'pointer' }}>{checkoutBusy ? 'Opening checkout…' : 'Claim founding spot'}</button>
            )}
            <div style={{ marginTop: 12, fontSize: 11.5, color: 'var(--text-dim)' }}>
              14-day refund on payment errors · Founders lock $99 forever
            </div>
          </>
        )}
      </section>

      <Footer />

      <MonthlyWaitlistModal open={monthlyOpen} onClose={() => setMonthlyOpen(false)} />
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

function Col({
  title, description, price, priceSub, crossedPrice, subLine,
  cta, badge, highlight, muted, features = [],
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

      {/* Bottom block — features list, fixed min height for consistent bottom edge */}
      <div className="cue-col-bottom" style={{ padding: 40, minHeight: 240, borderTop: `1px dashed ${LINE}`, boxSizing: 'border-box' }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {features.map((f, i) => {
            const isObj = typeof f === 'object'
            const text = isObj ? f.text : f
            const soon = isObj && f.soon
            return (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text)', lineHeight: 1.2 }}>
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke={highlight ? 'var(--electric)' : 'var(--text-dim)'} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>
                  {text}
                  {soon && (
                    <span style={{
                      marginLeft: 6, padding: '1px 6px',
                      background: 'rgba(204,255,0,0.10)', border: '1px solid rgba(204,255,0,0.28)',
                      color: '#ccff00', fontSize: 9, fontWeight: 500, letterSpacing: '0.08em',
                    }}>SOON</span>
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
  { q: 'What am I buying right now?', a: '50+ curated components with AI prompts. Every weekly drop. React source code and MCP support as they ship — free for Cue+ members. Locked at $99 lifetime for the first 50 founding members.' },
  { q: 'How is Cue different from every other component library?', a: 'Open the library and check for yourself before deciding. Every item on Cue is hand-picked from an Awwwards-caliber site or a best-in-class interaction from Behance / Dribbble / production apps that shipped it well. Nothing generic, nothing generated to fill the grid. If you can point me to a better reference for the same component, I will replace it. That is the bar — taste over volume.' },
  { q: 'What is live today vs coming soon?', a: 'Live: 50+ components + AI prompts, unlimited prompt copies for Cue+, weekly drops. Coming next few weeks: React source code for the top 20 components. Coming Q2: MCP support. All future drops included in your Cue+ lifetime.\n\nMeanwhile — a founding-member perk: if you need production code for any specific component before it ships publicly, email me and I will personally hand-ship that component\'s code to you. That is one of the ways founding pricing pays for itself.' },
  { q: 'Why lifetime, not subscription?', a: "Cue isn't a service you keep logging into. You copy a prompt, ship, close the tab. Charging you every month for something you touch twice a week feels wrong. Pay once, own it." },
  { q: 'What happens after the founding 50 fills?', a: 'Price becomes $249 lifetime for everyone after. Founding members keep their $99 forever — no future price change ever applies to them. That is the founding promise.' },
  { q: 'Refund policy?', a: 'Payment errors (duplicate charges, failed provisioning) — refunded within 3 business days. Within 24 hours of purchase and no premium content copied — full refund. See the Refund page for exact eligibility.' },
  { q: 'Can I use these in client work?', a: 'Yes. Cue+ includes personal and commercial use across unlimited projects. You cannot resell Cue prompts as your own library or train an AI on them. See the License page.' },
  { q: 'Can I use these in Framer?', a: 'Yes — two ways.\n\n1. Framer AI: paste any Cue prompt into Framer\'s AI panel. Most work directly; some scroll / WebGL-heavy ones may need one re-prompt for Framer\'s constraint system.\n\n2. Code Components: once the React code ships (weeks away), drop it into Framer via Insert → Code Component. Fully editable in your canvas.\n\nFounding members can request code for any specific component now — email me and I ship it personally.' },
  { q: 'Why pay when AI writes components?', a: 'AI produces generic. The gap between "a hero section" and "a hero section that feels like the Awwwards site of the day" is not a prompt-length problem — it is a taste problem. Each Cue prompt is refined through hundreds of AI iterations. You get iteration nine, not iteration one.' },
  { q: 'What if Cue shuts down?', a: '60 days written notice. Everything you unlocked stays downloadable. Pro-rata refund for anything under 12 months old. It is in the Terms.' },
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
