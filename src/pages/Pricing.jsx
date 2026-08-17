import React, { useState } from 'react'
import { useUser, SignInButton, UserButton } from '@clerk/clerk-react'
import { backend } from '../lib/backend.js'
import Footer from '../components/Footer.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'
import '../styles/overhaul.css'

/**
 * CUE — Pricing page (v3).
 * Display type: Instrument Serif upright (refined editorial without italic).
 * UI type: Geist (sans, medium weight — no aggressive bolds).
 * Copy: rewritten in CUE voice — specific, taste-forward, honest about beta.
 */

// Display type — Geist across the page. Medium weight (500) is refined
// without being aggressive; tight tracking gives large sizes a premium
// feel. No serif, no italic.
const displayStyle = {
  fontFamily: 'Geist, -apple-system, sans-serif',
  fontWeight: 500,
  fontStyle: 'normal',
  letterSpacing: '-0.03em',
  lineHeight: 1.05,
}

const priceStyle = {
  fontFamily: 'Geist, -apple-system, sans-serif',
  fontWeight: 500,
  fontStyle: 'normal',
  letterSpacing: '-0.04em',
  lineHeight: 1,
}

export default function Pricing() {
  usePageMeta({
    title: 'Pricing — founding member',
    description: 'Free forever for the essentials. Cue+ Individual $79 lifetime. Team $249 lifetime. Founding member pricing while it lasts.',
  })
  const { isSignedIn, user } = useUser()
  const [reservingTier, setReservingTier] = useState(null)
  const [reservedTier, setReservedTier] = useState(null)
  const [error, setError] = useState('')

  const reserve = async (tier) => {
    setError('')
    if (!isSignedIn) {
      setError('Sign in first, then reserve your spot.')
      return
    }
    setReservingTier(tier)
    try {
      const email = user?.primaryEmailAddress?.emailAddress
      if (!email) throw new Error("Couldn't read the email on your account.")
      await backend.subscribeWaitlist(email, `pricing-${tier}`)
      setReservedTier(tier)
    } catch (e) {
      setError(e?.message || 'Could not save your spot. Try again shortly.')
    } finally {
      setReservingTier(null)
    }
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: 'var(--font-sans)', color: 'var(--text)' }}>

      {/* Nav */}
      <nav className="cue-nav" style={{ position: 'sticky', top: 0, zIndex: 100, padding: '16px 24px', background: '#060606', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <a href="#/" style={{ display: 'flex', alignItems: 'baseline', gap: '8px', textDecoration: 'none' }}>
          <div style={{ ...displayStyle, fontSize: '24px', color: 'var(--text)' }}>Cue</div>
          <span style={{
            fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase',
            padding: '3px 8px', borderRadius: '999px',
            background: 'rgba(204,255,0,0.14)', color: '#ccff00',
            border: '1px solid rgba(204,255,0,0.45)', lineHeight: 1,
          }}>Beta</span>
        </a>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href="#/" style={{ fontSize: '12px', color: 'var(--text-dim)', textDecoration: 'none' }}>← Back to library</a>
          {!isSignedIn ? (
            <SignInButton mode="modal">
              <button style={{ background: 'var(--electric)', color: '#fff', border: 'none', padding: '6px 14px', borderRadius: '3px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }}>Sign in</button>
            </SignInButton>
          ) : (
            <UserButton showName appearance={{ elements: { userButtonOuterIdentifier: { color: 'var(--text)', fontSize: '12px' } } }} />
          )}
        </div>
      </nav>

      {/* Hero — Instrument Serif upright, refined without italic */}
      <section style={{ padding: '96px 24px 48px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--electric)', fontWeight: 700, marginBottom: 20 }}>
          Founding member pricing
        </div>
        <h1 style={{
          ...displayStyle,
          fontSize: 'clamp(32px, 4.6vw, 60px)',
          fontWeight: 300,
          letterSpacing: '-0.02em',
          lineHeight: 1.08,
          margin: 0,
          color: 'var(--text)',
        }}>
          The library your<br />favorite sites steal from.
        </h1>
        <p style={{ margin: '32px auto 0', maxWidth: 560, fontSize: 15, lineHeight: 1.6, color: 'var(--text-dim)' }}>
          Curated premium web experiences — sections, interactions, effects. Every item ships with production-ready code and an AI prompt that regenerates it in your stack. Free forever for the essentials. Cue+ is the whole library, for life.
        </p>
      </section>

      {/* Three-tier grid */}
      <section style={{
        maxWidth: 1180, margin: '0 auto', padding: '20px 24px 40px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '20px',
        alignItems: 'stretch',
      }}>

        {/* FREE */}
        <PlanCard
          label="Free"
          title="Just browsing"
          subtitle="Everything you need to look around."
          price="$0"
          suffix="forever"
          bullets={[
            'Full library — every curated component',
            'Copy code + AI prompts for free items',
            'New drops emailed as they ship',
            'Live previews, teardowns, and stack notes',
          ]}
          ctaLabel="Start browsing"
          ctaHref="#/"
        />

        {/* CUE+ INDIVIDUAL — highlighted */}
        <PlanCard
          highlight
          badge="★ Founding · Limited"
          label="Cue+"
          title="The whole library"
          subtitle="Every premium drop, yours for life."
          price="$79"
          strikePrice="$199"
          suffix="one-time · lifetime"
          scarcityNote="First 100 founding members · $199 after"
          bullets={[
            'Everything in Free',
            'Every Cue+ premium component',
            'All future drops — no recurring charges',
            'License for personal & freelance work',
            'Priority request queue',
            'Founding-member badge on your profile',
          ]}
          ctaLabel="Reserve founding spot"
          onCta={() => reserve('individual')}
          reserving={reservingTier === 'individual'}
          reserved={reservedTier === 'individual'}
          isSignedIn={isSignedIn}
        />

        {/* CUE+ TEAM */}
        <PlanCard
          label="Cue+ Team"
          title="For studios shipping client work"
          subtitle="Ship faster without design debt."
          price="$249"
          strikePrice="$499"
          suffix="one-time · lifetime · up to 5 seats"
          bullets={[
            'Everything in Cue+',
            'Commercial license (paid client work)',
            'Up to 5 team seats',
            'White-label — deliver under your studio brand',
            'Priority Slack channel with the team',
            'Team-wide founding badge',
          ]}
          ctaLabel="Reserve team spot"
          onCta={() => reserve('team')}
          reserving={reservingTier === 'team'}
          reserved={reservedTier === 'team'}
          isSignedIn={isSignedIn}
        />
      </section>

      {error && (
        <div style={{ maxWidth: 720, margin: '0 auto 20px', padding: '10px 14px', background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.28)', borderRadius: 6, fontSize: 12.5, color: 'var(--danger)', textAlign: 'center' }}>
          {error}
        </div>
      )}

      {/* Three quiet promises — a single tight row, no cards */}
      <section style={{ maxWidth: 900, margin: '10px auto 0', padding: '10px 24px', display: 'flex', gap: 28, justifyContent: 'center', flexWrap: 'wrap', fontSize: 12.5, color: 'var(--text-dim)' }}>
        <span>14-day refund</span>
        <span style={{ opacity: 0.35 }}>·</span>
        <span>Framework-agnostic</span>
        <span style={{ opacity: 0.35 }}>·</span>
        <span>Pay once, own forever</span>
      </section>

      {/* FAQ */}
      <section style={{ maxWidth: 720, margin: '96px auto 40px', padding: '0 24px' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--electric)', fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>Common questions</div>
        <h2 style={{ ...displayStyle, fontSize: 'clamp(32px, 5vw, 56px)', textAlign: 'center', margin: '0 0 44px' }}>
          Every quiet doubt, answered.
        </h2>
        <FaqItem
          q="What is CUE, exactly?"
          a="A curated library of premium, award-tier web experiences — sections, interactions, effects. Each item ships with the production code, an AI prompt that regenerates it in your stack (Cursor, v0, Bolt, Framer), and a short teardown explaining how it works."
        />
        <FaqItem
          q="Free vs Cue+?"
          a="Free lets you browse the entire library, copy free components, and get every new drop by email. Cue+ unlocks every premium (Cue+) component, adds a personal / freelance license, and includes all future drops forever. Cue+ Team extends that with commercial rights for client work and up to 5 seats."
        />
        <FaqItem
          q="Is it really a one-time payment?"
          a="Yes. Cue+ is a single lifetime purchase — no monthly, no yearly, no auto-renewal. Founding pricing ($79 / $249) locks in when you reserve; it rises to $199 / $499 once the first 100 spots go."
        />
        <FaqItem
          q="Can I use CUE components in client projects?"
          a="Cue+ Team includes a commercial license — ship them in paid client work, agency deliverables, monetized products. Cue+ (individual) covers personal + freelance. Free tier is personal / open-source only. In no tier can you resell the components as a library themselves."
        />
        <FaqItem
          q="Which frameworks are supported?"
          a="Most components are framework-agnostic — plain HTML/CSS/JS or React. Where an item leans on a library (GSAP, Framer Motion, Three.js), it's called out on the card. The AI prompt lets you regenerate the same effect for whichever stack you're using."
        />
        <FaqItem
          q="What if I don't like it?"
          a="14 days, no questions asked. Email us and we refund the full amount."
        />
        <FaqItem
          q="When does the beta open?"
          a="Founding members get first access. We're building openly — reserve your spot above and you'll be the first to know when checkout opens."
        />
      </section>

      {/* Final CTA */}
      <section style={{ maxWidth: 720, margin: '20px auto 40px', padding: '56px 24px', textAlign: 'center', borderTop: '1px solid var(--border)' }}>
        <h3 style={{ ...displayStyle, fontSize: 'clamp(28px, 4vw, 48px)', margin: '0 0 14px' }}>
          Stop shipping average.
        </h3>
        <p style={{ margin: '0 auto 28px', maxWidth: 460, color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.6 }}>
          Founding pricing is capped at the first 100 spots. When those go, so does the lock.
        </p>
        <div style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {!isSignedIn ? (
            <SignInButton mode="modal">
              <button style={{ padding: '13px 22px', background: 'var(--electric)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 600, letterSpacing: '0.02em', cursor: 'pointer' }}>
                Reserve founding spot
              </button>
            </SignInButton>
          ) : reservedTier ? (
            <span style={{ padding: '13px 22px', background: 'rgba(204,255,0,0.1)', border: '1px solid rgba(204,255,0,0.4)', borderRadius: 10, fontSize: 13.5, color: 'var(--text)', fontWeight: 600 }}>
              ✓ You're on the founding list.
            </span>
          ) : (
            <button
              onClick={() => reserve('individual')}
              disabled={reservingTier !== null}
              style={{ padding: '13px 22px', background: reservingTier ? '#1c1c1e' : 'var(--electric)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13.5, fontWeight: 600, letterSpacing: '0.02em', cursor: reservingTier ? 'wait' : 'pointer' }}
            >
              {reservingTier ? 'Reserving…' : 'Reserve founding spot'}
            </button>
          )}
          <a href="#/" style={{ padding: '13px 22px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, fontSize: 13.5, fontWeight: 500, color: 'var(--text)', textDecoration: 'none' }}>
            Browse the library
          </a>
        </div>
      </section>

      <Footer />
    </div>
  )
}

// ---------------------------------------------------------------------------
function PlanCard({
  label, title, subtitle,
  price, strikePrice, suffix, scarcityNote,
  bullets, ctaLabel, ctaHref, onCta,
  highlight = false, badge,
  reserving, reserved, isSignedIn,
}) {
  const cardBg = highlight ? 'var(--electric)' : '#141416'
  const cardText = highlight ? '#fff' : 'var(--text)'
  const dimText = highlight ? 'rgba(255,255,255,0.72)' : 'var(--text-dim)'
  const dimmerText = highlight ? 'rgba(255,255,255,0.55)' : 'var(--text-dimmer)'
  const bulletCheckBg = highlight ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)'
  const bulletCheckColor = highlight ? '#fff' : 'var(--text-dim)'
  const cardBorder = highlight ? 'transparent' : 'var(--border)'
  const btnBg = highlight ? '#fff' : 'var(--electric)'
  const btnText = highlight ? '#000' : '#fff'

  const isSuccess = reserved

  return (
    <div style={{
      background: cardBg,
      color: cardText,
      border: `1px solid ${cardBorder}`,
      borderRadius: 12,
      padding: '28px 24px',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      boxShadow: highlight ? '0 20px 60px -25px rgba(0,0,255,0.5)' : 'none',
    }}>
      {badge && (
        <div style={{
          position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
          padding: '5px 12px', borderRadius: 999,
          background: '#ccff00', color: '#000',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase',
          whiteSpace: 'nowrap',
        }}>{badge}</div>
      )}

      <div style={{ fontSize: 10.5, letterSpacing: '0.18em', textTransform: 'uppercase', color: dimText, fontWeight: 600, marginBottom: 12 }}>{label}</div>
      <h2 style={{ ...displayStyle, fontSize: 24, margin: '0 0 6px', color: cardText }}>{title}</h2>
      <div style={{ color: dimText, fontSize: 13.5, marginBottom: 26, lineHeight: 1.5 }}>{subtitle}</div>

      {/* Price */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ ...priceStyle, fontSize: 56, color: cardText }}>{price}</span>
        {strikePrice && (
          <span style={{ color: dimmerText, fontSize: 16, textDecoration: 'line-through' }}>{strikePrice}</span>
        )}
      </div>
      <div style={{ color: dimText, fontSize: 12.5, marginBottom: scarcityNote ? 6 : 26 }}>{suffix}</div>
      {scarcityNote && (
        <div style={{ color: '#ccff00', fontSize: 11, letterSpacing: '0.06em', marginBottom: 26 }}>
          {scarcityNote}
        </div>
      )}

      {/* CTA */}
      {onCta ? (
        isSuccess ? (
          <div style={{
            padding: '12px 14px',
            background: highlight ? 'rgba(255,255,255,0.15)' : 'rgba(204,255,0,0.1)',
            border: highlight ? '1px solid rgba(255,255,255,0.35)' : '1px solid rgba(204,255,0,0.4)',
            color: cardText,
            borderRadius: 10, marginBottom: 24, fontSize: 13, textAlign: 'center', fontWeight: 600,
          }}>✓ You're on the list. We'll email you when checkout opens.</div>
        ) : isSignedIn ? (
          <button
            onClick={onCta}
            disabled={reserving}
            style={{
              padding: '13px 16px',
              background: reserving ? '#1c1c1e' : btnBg,
              color: reserving ? 'var(--text-dimmer)' : btnText,
              border: 'none', borderRadius: 10,
              fontSize: 13.5, fontWeight: 600, letterSpacing: '0.02em',
              cursor: reserving ? 'wait' : 'pointer',
              marginBottom: 10,
              fontFamily: 'var(--font-sans)',
              transition: 'background 0.2s ease',
            }}
          >{reserving ? 'Reserving…' : ctaLabel}</button>
        ) : (
          <SignInButton mode="modal">
            <button
              style={{
                padding: '13px 16px',
                background: btnBg, color: btnText,
                border: 'none', borderRadius: 10,
                fontSize: 13.5, fontWeight: 600, letterSpacing: '0.02em',
                cursor: 'pointer', marginBottom: 10,
                fontFamily: 'var(--font-sans)',
              }}
            >{ctaLabel}</button>
          </SignInButton>
        )
      ) : (
        <a
          href={ctaHref}
          style={{
            display: 'inline-block', textAlign: 'center',
            padding: '13px 16px',
            background: 'transparent',
            color: cardText,
            border: '1px solid var(--border)',
            borderRadius: 10,
            fontSize: 13.5, fontWeight: 600, letterSpacing: '0.02em', textDecoration: 'none',
            marginBottom: 24,
          }}
        >{ctaLabel}</a>
      )}
      {onCta && !isSuccess && (
        <div style={{ fontSize: 11, color: dimmerText, marginBottom: 24, textAlign: 'center' }}>
          No payment now. Locked founding price when checkout opens.
        </div>
      )}

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
        {bullets.map((b, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13.5, color: cardText, lineHeight: 1.5 }}>
            <span style={{
              flex: '0 0 auto',
              width: 18, height: 18, marginTop: 1, borderRadius: 999,
              background: bulletCheckBg,
              color: bulletCheckColor,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
              border: highlight ? '1px solid rgba(255,255,255,0.28)' : '1px solid var(--border)',
            }}>✓</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function GuaranteeCard({ title, body }) {
  return (
    <div style={{ padding: '22px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: 14 }}>
      <div style={{ ...displayStyle, fontSize: 15, marginBottom: 6, color: 'var(--text)' }}>{title}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-dim)', lineHeight: 1.55 }}>{body}</div>
    </div>
  )
}

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', padding: '20px 4px', background: 'transparent', border: 'none',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          color: 'var(--text)', textAlign: 'left', cursor: 'pointer',
          fontFamily: 'Geist, -apple-system, sans-serif',
          fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em',
        }}
      >
        <span>{q}</span>
        <span style={{ color: 'var(--text-dim)', fontSize: 22, lineHeight: 1, transition: 'transform 0.2s ease', transform: open ? 'rotate(45deg)' : 'rotate(0deg)' }}>+</span>
      </button>
      {open && (
        <div style={{ padding: '0 4px 20px', color: 'var(--text-dim)', fontSize: 14, lineHeight: 1.65, fontFamily: 'var(--font-sans)' }}>
          {a}
        </div>
      )}
    </div>
  )
}
