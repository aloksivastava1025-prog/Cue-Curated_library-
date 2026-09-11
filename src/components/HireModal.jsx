import React, { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { backend } from '../lib/backend.js'

/**
 * "Hire me" — lightweight project-brief modal.
 *
 * Purpose: capture higher-ticket build enquiries (Awwwards-tier
 * landings, SaaS UIs, portfolios) without shipping a full services
 * page. Same UX pattern as CustomPackModal so users feel
 * consistency across the site.
 *
 * Follow-up: Alok DMs / emails the person, agrees scope + price,
 * ships the build. There is no on-site payment path for this — it
 * is a lead form only.
 */
export default function HireModal({ open, onClose }) {
  const { user, isSignedIn } = useUser()

  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [projectDesc, setProjectDesc] = useState('')
  const [siteType, setSiteType] = useState('landing')
  const [budget, setBudget] = useState('500-2000')
  const [timeline, setTimeline] = useState('normal')
  const [message, setMessage] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!open) return
    if (isSignedIn && user) {
      const em = user?.primaryEmailAddress?.emailAddress
        || user?.emailAddresses?.[0]?.emailAddress || ''
      if (em && !contact) setContact(em)
      const nm = user?.fullName || [user?.firstName, user?.lastName].filter(Boolean).join(' ')
      if (nm && !name) setName(nm)
    }
  }, [open, isSignedIn, user])

  useEffect(() => {
    if (!open) {
      setDone(false); setErr(''); setSubmitting(false)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  const submit = async () => {
    if (submitting) return
    setErr('')
    if (!name.trim()) { setErr('Your name helps.'); return }
    const raw = contact.trim()
    if (!raw) { setErr('Email or X handle so we can reach you.'); return }
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)
    const isXHandle = /^@?[a-z0-9_]{1,15}$/i.test(raw)
    if (!isEmail && !isXHandle) {
      setErr('Use a real email or an X handle (@username).')
      return
    }
    if (!projectDesc.trim() || projectDesc.trim().length < 20) {
      setErr('Tell us a bit more about the project (at least a sentence).')
      return
    }
    setSubmitting(true)
    try {
      await backend.submitHireRequest({
        name,
        contact: raw,
        contactType: isEmail ? 'email' : 'x_handle',
        projectDesc,
        siteType,
        budget,
        timeline,
        message,
        userId: isSignedIn ? user?.id : null,
      })
      setDone(true)
    } catch (e) {
      setErr(e?.message || 'Could not send. Try again.')
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
        data-lenis-prevent
        style={{
          width: '100%', maxWidth: 620, maxHeight: '96vh',
          background: '#0a0a0a',
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 12,
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          fontFamily: 'var(--font-sans, system-ui)',
          color: 'var(--text, #fff)',
        }}
      >
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim, rgba(255,255,255,0.5))' }}>
              Hire me · Awwwards-tier build
            </div>
            <div style={{ fontSize: 18, fontFamily: 'var(--font-serif, Georgia)', fontStyle: 'italic', marginTop: 2 }}>
              Send a project brief
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text, #fff)', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}
            aria-label="Close"
          >✕</button>
        </div>

        {done ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>✓</div>
            <div style={{ fontFamily: 'var(--font-serif, Georgia)', fontStyle: 'italic', fontSize: 26, marginBottom: 10 }}>
              Brief received.
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-dim, rgba(255,255,255,0.7))', maxWidth: 460, margin: '0 auto', lineHeight: 1.55 }}>
              Alok will reach out within 48 hrs to scope the project and agree a price. Faster: DM{' '}
              <a href="https://x.com/alok619308" target="_blank" rel="noopener noreferrer" style={{ color: '#1DA1F2', textDecoration: 'underline' }}>@alok619308 on X</a>.
            </div>
            <button
              onClick={onClose}
              style={{ marginTop: 24, background: 'var(--electric, #3D50E8)', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Back to library
            </button>
          </div>
        ) : (
          <div style={{ padding: 20, overflowY: 'auto', minHeight: 0 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name *" style={inputStyle} />
              <input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Email or X handle *" style={inputStyle} />
              <textarea
                value={projectDesc}
                onChange={(e) => setProjectDesc(e.target.value)}
                placeholder="What are you building? — the vibe, target users, the one-liner *"
                rows={4}
                style={{ ...inputStyle, gridColumn: '1 / -1', resize: 'vertical', fontFamily: 'inherit' }}
              />

              <Radio
                label="Site type"
                value={siteType}
                onChange={setSiteType}
                options={[
                  { v: 'landing', l: 'Landing / single page' },
                  { v: 'saas', l: 'SaaS product (multi-page, login)' },
                  { v: 'portfolio', l: 'Portfolio / personal' },
                  { v: 'app', l: 'Full app (backend + logic)' },
                  { v: 'other', l: 'Other' },
                ]}
              />
              <Radio
                label="Budget (USD)"
                value={budget}
                onChange={setBudget}
                options={[
                  { v: 'under-500', l: 'Under $500' },
                  { v: '500-2000', l: '$500 — $2,000' },
                  { v: '2000-5000', l: '$2,000 — $5,000' },
                  { v: '5000-15000', l: '$5,000 — $15,000' },
                  { v: '15000-plus', l: '$15,000+' },
                  { v: 'flexible', l: 'Open / flexible' },
                ]}
              />
              <Radio
                label="Timeline"
                value={timeline}
                onChange={setTimeline}
                options={[
                  { v: 'rush', l: 'Rush · 1 week' },
                  { v: 'normal', l: 'Normal · 2-4 weeks' },
                  { v: 'flexible', l: 'Flexible' },
                ]}
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Anything else? (optional)"
                rows={2}
                style={{ ...inputStyle, gridColumn: '1 / -1', resize: 'vertical', fontFamily: 'inherit' }}
              />
              {err && (
                <div style={{ gridColumn: '1 / -1', color: '#ff6b6b', fontSize: 12 }}>{err}</div>
              )}
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 6 }}>
                <span style={{ fontSize: 11.5, color: 'var(--text-dim, rgba(255,255,255,0.5))', maxWidth: 360, lineHeight: 1.5 }}>
                  I take a few Awwwards-tier builds every quarter. If we're a fit, I'll DM you within 48 hrs to scope & quote.
                </span>
                <button
                  onClick={submit}
                  disabled={submitting}
                  style={{
                    background: 'var(--electric, #3D50E8)', color: '#fff', border: 'none',
                    padding: '10px 20px', borderRadius: 8,
                    fontSize: 13, fontWeight: 600,
                    cursor: submitting ? 'wait' : 'pointer',
                    opacity: submitting ? 0.6 : 1,
                    letterSpacing: '0.02em',
                  }}
                >
                  {submitting ? 'Sending…' : 'Send brief'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Radio({ label, value, onChange, options }) {
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <div style={{ fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim, rgba(255,255,255,0.5))', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {options.map((o) => {
          const on = value === o.v
          return (
            <button
              type="button"
              key={o.v}
              onClick={() => onChange(o.v)}
              style={{
                padding: '6px 12px',
                background: on ? 'rgba(61,80,232,0.14)' : 'rgba(255,255,255,0.04)',
                border: '1px solid ' + (on ? 'rgba(61,80,232,0.5)' : 'rgba(255,255,255,0.10)'),
                color: on ? '#fff' : 'var(--text-dim, rgba(255,255,255,0.65))',
                borderRadius: 8,
                fontSize: 12, cursor: 'pointer',
                letterSpacing: '0.02em',
              }}
            >{o.l}</button>
          )
        })}
      </div>
    </div>
  )
}

const inputStyle = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.10)',
  color: '#fff',
  fontSize: 13,
  padding: '10px 12px',
  borderRadius: 8,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}
