import React, { useEffect, useMemo, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { backend } from '../lib/backend.js'
import WhatsAppButton from './WhatsAppButton.jsx'

/**
 * Visual "build your own pack" modal.
 *
 * Why this exists:
 *   Real feedback from a potential buyer — "I only needed a couple of
 *   specific components, buying the whole thing felt like paying for
 *   stuff I wouldn't use." A text-input list ("cue056, cue081") is
 *   user-hostile because the whole point of the library is the
 *   visual browsing. So this modal shows every component's thumbnail
 *   in a grid, lets the user tap/click to toggle selection, and
 *   submits the picked ids + email to the admin.
 *
 * How the follow-up works:
 *   1. User picks N components + submits with email + message
 *   2. Row lands in Supabase `custom_pack_requests` (status = pending)
 *   3. Admin reviews, generates a Dodo payment link at a custom
 *      price, and sends it back manually (email / DM)
 *   4. On payment, admin grants access to those component ids
 *      (mechanism TBD — for MVP, admin flips user to Cue+)
 *
 * Explicit non-goals for v0.1:
 *   - No cart, no dynamic price display, no live discount math.
 *     Everything is quoted manually. This is the launch-phase
 *     validation surface, not the final self-serve cart.
 */
export default function CustomPackModal({ open, onClose }) {
  const { user, isSignedIn } = useUser()

  const [prompts, setPrompts] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadErr, setLoadErr] = useState('')

  const [q, setQ] = useState('')
  const [picked, setPicked] = useState(() => new Set())
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  // Buyer's proposed price. Made mandatory so Alok never has to
  // guess someone's budget on the first reply — cuts one full
  // email round-trip out of every custom-pack thread.
  const [quote, setQuote] = useState('')
  const [message, setMessage] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitErr, setSubmitErr] = useState('')
  const [done, setDone] = useState(false)

  // Prefill email + name from Clerk when signed in.
  useEffect(() => {
    if (!open) return
    if (isSignedIn && user) {
      const em = user?.primaryEmailAddress?.emailAddress
        || user?.emailAddresses?.[0]?.emailAddress
        || ''
      if (em && !email) setEmail(em)
      const nm = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ')
      if (nm && !name) setName(nm)
    }
  }, [open, isSignedIn, user])

  // Load the visible library on open. Cheap because we only need
  // id/title/thumb/tier/category for the picker — full content isn't
  // needed until admin fulfils the pack.
  useEffect(() => {
    if (!open) return
    if (prompts.length > 0) return
    setLoading(true); setLoadErr('')
    backend.list()
      .then((rows) => setPrompts((rows || []).filter((r) => (r.status || 'published') === 'published')))
      .catch((e) => setLoadErr(e?.message || 'Could not load library'))
      .finally(() => setLoading(false))
  }, [open])

  // Reset transient UI when the modal closes.
  useEffect(() => {
    if (!open) {
      setDone(false); setSubmitErr(''); setSubmitting(false); setQ('')
    }
  }, [open])

  // Lock body scroll while the modal is open — otherwise the wheel /
  // touch scrolls the page behind, not the grid inside the modal.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return prompts
    return prompts.filter((r) => {
      const hay = `${r.title || ''} ${r.category || ''} ${(r.tags || []).join(' ')}`.toLowerCase()
      return hay.includes(needle)
    })
  }, [prompts, q])

  const toggle = (id) => {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const submit = async () => {
    if (submitting) return
    setSubmitErr('')
    if (picked.size === 0) { setSubmitErr('Pick at least one component.'); return }
    const raw = email.trim()
    if (!raw) { setSubmitErr('Give us an email or X handle so we can reach you.'); return }
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)
    const isXHandle = /^@?[a-z0-9_]{1,15}$/i.test(raw)
    if (!isEmail && !isXHandle) {
      setSubmitErr('Use a real email (you@example.com) or an X handle (@username).')
      return
    }
    // Quote is now required — cuts one email round-trip.
    const quoteRaw = quote.trim()
    const quoteNum = Number(quoteRaw.replace(/[^0-9.]/g, ''))
    if (!quoteRaw || !Number.isFinite(quoteNum) || quoteNum <= 0) {
      setSubmitErr('Add a proposed price so Alok can reply with a real yes/no.')
      return
    }
    // Backend requires a valid email column. If the user gave an X
    // handle, we stash a synthetic address so the insert doesn't
    // fail; the real contact is in `message` so Alok can DM them.
    const emailToSend = isEmail ? raw : `${raw.replace(/^@/, '').toLowerCase()}@x.handle`
    const quoteLine = `Proposed price: ${quoteRaw}`
    const contactLine = isEmail ? null : `Contact via X: ${raw.startsWith('@') ? raw : '@' + raw}`
    const composedMessage = [contactLine, quoteLine, message].filter(Boolean).join('\n\n')
    setSubmitting(true)
    try {
      await backend.submitCustomPackRequest({
        email: emailToSend,
        name,
        componentIds: Array.from(picked),
        message: composedMessage,
        userId: isSignedIn ? user?.id : null,
      })
      setDone(true)
    } catch (e) {
      setSubmitErr(e?.message || 'Could not send request')
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2vh 2vw',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 1100, height: '96vh',
          background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'var(--font-sans, system-ui)',
          color: 'var(--text, #fff)',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim, rgba(255,255,255,0.5))' }}>
              Custom pack · fair pricing
            </div>
            <div style={{ fontSize: 18, fontFamily: 'var(--font-serif, Georgia)', fontStyle: 'italic', marginTop: 2 }}>
              Pick what you need — we'll set a fair price
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim, rgba(255,255,255,0.6))' }}>
              {picked.size} selected
            </span>
            <button
              onClick={onClose}
              style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text, #fff)', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}
              aria-label="Close"
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {done ? (
          <SuccessScreen count={picked.size} onClose={onClose} />
        ) : (
          <>
            {/* Search */}
            <div style={{ padding: '12px 22px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by title, category or tag…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: '#fff', fontSize: 13,
                  padding: '10px 14px', borderRadius: 8, outline: 'none',
                }}
              />
            </div>

            {/* Grid — minHeight:0 lets a flex child actually shrink
                below its content and become scrollable. Without it,
                flex:1 + overflow:auto silently fails and the whole
                page scrolls instead. overscrollBehavior stops the
                scroll from chaining up to the body when we hit the
                top / bottom of the grid. */}
            <div
              data-lenis-prevent
              onWheel={(e) => e.stopPropagation()}
              style={{
                flex: 1, overflowY: 'auto', overflowX: 'hidden',
                minHeight: 0,
                padding: '16px 22px',
                WebkitOverflowScrolling: 'touch',
                overscrollBehavior: 'contain',
              }}
            >
              {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim, rgba(255,255,255,0.5))' }}>Loading library…</div>}
              {loadErr && <div style={{ padding: 20, color: '#ff6b6b', fontSize: 13 }}>{loadErr}</div>}
              {!loading && filtered.length === 0 && !loadErr && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-dim, rgba(255,255,255,0.5))' }}>
                  Nothing matched — try a different keyword.
                </div>
              )}
              {!loading && filtered.length > 0 && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: 12,
                }}>
                  {filtered.map((row) => (
                    <PickerCard
                      key={row.id}
                      row={row}
                      picked={picked.has(row.id)}
                      onToggle={() => toggle(row.id)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer form */}
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.08)',
              padding: '14px 22px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 10,
              alignItems: 'start',
            }}>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email or X handle (@username) · required"
                type="text"
                style={inputStyle}
                required
              />
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name (optional)"
                style={inputStyle}
              />
              <input
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="Your proposed price · required (e.g. $60 or ₹4,500)"
                type="text"
                style={{ ...inputStyle, gridColumn: '1 / -1' }}
                required
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Context — what you're building, stack, any specific tweaks (optional)"
                rows={2}
                style={{ ...inputStyle, gridColumn: '1 / -1', resize: 'vertical', fontFamily: 'inherit' }}
              />
              {submitErr && (
                <div style={{ gridColumn: '1 / -1', color: '#ff6b6b', fontSize: 12 }}>{submitErr}</div>
              )}
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-dim, rgba(255,255,255,0.5))', lineHeight: 1.5, maxWidth: 520 }}>
                  Give us your email <em>or</em> X handle above. Alok reaches out within 24 hrs, agrees a fair price, and sends a payment link. Faster: DM <a href="https://x.com/alok619308" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'underline' }}>@alok619308</a> on X directly — activation happens from there.
                  <WhatsAppButton variant="inline" style={{ display: 'inline-flex', marginLeft: 6 }} />
                </span>
                {(() => {
                  // Disable until all three requirements are met:
                  //   1. at least one component picked
                  //   2. a plausible email or X handle
                  //   3. a plausible price (> 0)
                  const emailRaw = email.trim()
                  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)
                    || /^@?[a-z0-9_]{1,15}$/i.test(emailRaw)
                  const quoteNum = Number(quote.trim().replace(/[^0-9.]/g, ''))
                  const quoteOk = quote.trim().length > 0 && Number.isFinite(quoteNum) && quoteNum > 0
                  const ready = picked.size > 0 && emailOk && quoteOk
                  const gate = submitting
                    ? 'Sending…'
                    : picked.size === 0 ? 'Pick a component'
                    : !emailOk ? 'Add email / X handle'
                    : !quoteOk ? 'Add proposed price'
                    : `Send request · ${picked.size}`
                  return (
                    <button
                      onClick={submit}
                      disabled={submitting || !ready}
                      style={{
                        background: 'var(--electric, #0000ff)',
                        color: '#fff',
                        border: 'none',
                        padding: '10px 20px',
                        borderRadius: 8,
                        fontSize: 13, fontWeight: 600,
                        cursor: submitting ? 'wait' : (ready ? 'pointer' : 'not-allowed'),
                        opacity: submitting ? 0.6 : (ready ? 1 : 0.4),
                        letterSpacing: '0.02em',
                      }}
                    >
                      {gate}
                    </button>
                  )
                })()}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function PickerCard({ row, picked, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      style={{
        position: 'relative',
        display: 'block',
        width: '100%',
        aspectRatio: '4 / 3',
        borderRadius: 10,
        overflow: 'hidden',
        cursor: 'pointer',
        border: picked ? '2px solid var(--electric, #0000ff)' : '1px solid rgba(255,255,255,0.10)',
        background: '#111',
        padding: 0,
        outline: 'none',
        transition: 'border-color 120ms ease, transform 120ms ease',
        transform: picked ? 'scale(0.98)' : 'scale(1)',
      }}
      title={row.title}
    >
      {row.thumbSrc && (
        <img
          src={row.thumbSrc}
          alt={row.title || row.id}
          loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: picked ? 0.85 : 1 }}
        />
      )}
      <div style={{
        position: 'absolute', top: 8, right: 8,
        width: 22, height: 22, borderRadius: '50%',
        background: picked ? 'var(--electric, #0000ff)' : 'rgba(0,0,0,0.55)',
        border: picked ? 'none' : '1px solid rgba(255,255,255,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 13, fontWeight: 700,
      }}>
        {picked ? '✓' : ''}
      </div>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        padding: '20px 10px 8px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))',
        color: '#fff',
        fontSize: 11, textAlign: 'left',
        letterSpacing: '0.02em',
      }}>
        <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.title || row.id}
        </div>
        <div style={{ fontSize: 10, opacity: 0.65, marginTop: 1 }}>
          {row.id}{row.tier === 'paid' ? ' · premium' : ''}
        </div>
      </div>
    </button>
  )
}

function SuccessScreen({ count, onClose }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 40, textAlign: 'center',
    }}>
      <div style={{ fontSize: 42, marginBottom: 12 }}>✓</div>
      <div style={{ fontFamily: 'var(--font-serif, Georgia)', fontStyle: 'italic', fontSize: 26, marginBottom: 10 }}>
        Request received.
      </div>
      <div style={{ fontSize: 14, color: 'var(--text-dim, rgba(255,255,255,0.7))', maxWidth: 500, lineHeight: 1.55 }}>
        We got your {count} {count === 1 ? 'component' : 'components'}. Alok will DM within 24 hrs, agree on a fair price, and send a payment link to your registered email. Once you pay, components activate on your Cue account.
      </div>
      <div style={{ marginTop: 16, fontSize: 13, color: 'var(--text, #fff)', maxWidth: 500, lineHeight: 1.55 }}>
        <strong>Want it faster?</strong> DM{' '}
        <a
          href="https://x.com/alok619308"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#1DA1F2', textDecoration: 'underline' }}
        >@alok619308 on X</a>{' '}
        — activation happens directly from there.
      </div>
      <button
        onClick={onClose}
        style={{
          marginTop: 26,
          background: 'var(--electric, #0000ff)', color: '#fff', border: 'none',
          padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}
      >
        Back to library
      </button>
    </div>
  )
}

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: '#fff',
  fontSize: 13,
  padding: '9px 12px',
  borderRadius: 8,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}
