import React, { useState } from 'react'
import Footer from '../components/Footer.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { backend } from '../lib/backend.js'

/**
 * Contact page — sits at #/contact. Reachable from the footer.
 * Left column: canonical brand contact info (email, socials, address).
 * Right column: contact form that pipes into the existing feedback
 * table via backend.submitFeedback (source='contact-page'), so admin
 * sees the message in AdminInbox alongside other feedback.
 */
export default function Contact() {
  usePageMeta({
    title: 'Get in touch — Cue',
    description: 'Questions, requests, or feedback for Cue? Reach the founder directly.',
  })

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [state, setState] = useState('idle') // idle | ok | err
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (sending) return
    setErr(''); setState('idle')
    if (!message.trim()) { setErr('Write a message first'); return }
    setSending(true)
    try {
      await backend.submitFeedback({
        kind: 'other',
        message: `From: ${name.trim() || 'Anonymous'}\n\n${message.trim()}`,
        email: email.trim().toLowerCase() || null,
        source: 'contact-page',
      })
      setState('ok')
      setName(''); setEmail(''); setMessage('')
    } catch (e) {
      setState('err'); setErr(e?.message || 'Could not send. Try emailing hello@cuedesign.space directly.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column' }}>
      {/* Nav */}
      <nav style={{
        padding: '16px 24px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 16, background: '#060606',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        <a href="#/" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 22, color: 'var(--text)', textDecoration: 'none' }}>CUE</a>
        <span style={{ fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>Contact</span>
        <a href="#/" style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-dim)', textDecoration: 'none' }}>← Back to library</a>
      </nav>

      {/* Two-column layout */}
      <main style={{
        flex: 1,
        maxWidth: 1080, width: '100%',
        margin: '0 auto', padding: '80px 24px 100px',
        display: 'grid',
        gridTemplateColumns: 'minmax(280px, 1fr) minmax(320px, 1.4fr)',
        gap: 60,
      }} className="cue-contact-grid">

        {/* Left — brand info */}
        <div>
          <div style={{ fontSize: 10.5, letterSpacing: '0.20em', textTransform: 'uppercase', color: 'var(--electric)', fontWeight: 700, marginBottom: 14 }}>
            Get in touch
          </div>
          <h1 style={{
            fontFamily: 'var(--font-sans)', fontWeight: 500,
            fontSize: 'clamp(38px, 5.5vw, 60px)', letterSpacing: '-0.035em',
            margin: 0, lineHeight: 1.05,
          }}>
            Ask, and I'll answer.
          </h1>
          <p style={{
            margin: '20px 0 32px', fontSize: 14, lineHeight: 1.7,
            color: 'var(--text-dim)', maxWidth: 380,
          }}>
            One person builds Cue. Every message hits the same inbox.
            Refunds, feature requests, wrong-component reports,
            partnerships, or a quiet hello — all welcome.
          </p>

          {/* Primary email — highlighted so it's the clear default
              contact channel even if someone doesn't use the form. */}
          <div style={{
            padding: '14px 16px', borderRadius: 10,
            background: 'rgba(0,0,255,0.06)',
            border: '1px solid rgba(0,0,255,0.35)',
            marginBottom: 28,
          }}>
            <div style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--electric)', fontWeight: 700, marginBottom: 6 }}>
              Email me directly
            </div>
            <a href="mailto:hello@cuedesign.space?subject=Cue%20—%20"
               style={{
                 fontSize: 18, color: 'var(--text)', fontWeight: 500,
                 textDecoration: 'none', letterSpacing: '-0.01em',
                 display: 'inline-flex', alignItems: 'center', gap: 8,
               }}>
              hello@cuedesign.space
              <span style={{ color: 'var(--electric)', fontSize: 16 }}>→</span>
            </a>
            <div style={{ marginTop: 4, fontSize: 11.5, color: 'var(--text-dim)' }}>
              Fastest way. Replies within 5 business days.
            </div>
          </div>

          <ContactRow label="Twitter / X">
            <a href="https://x.com/Alok619308" target="_blank" rel="noopener noreferrer" style={contactValueLink}>
              @Alok619308
            </a>
          </ContactRow>

          <ContactRow label="Based in">
            <span style={contactValue}>Delhi, India · working remote</span>
          </ContactRow>

          {/* Social row */}
          <div style={{ marginTop: 32, display: 'flex', gap: 10 }}>
            <SocialPill href="https://x.com/Alok619308" label="X / Twitter" icon={<IconX />} />
            <SocialPill href="mailto:hello@cuedesign.space" label="Email" icon={<IconEmail />} />
          </div>
        </div>

        {/* Right — form */}
        <form onSubmit={submit} style={{
          background: '#0e0e10',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 28,
          display: 'flex', flexDirection: 'column', gap: 16,
          height: 'fit-content',
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14,
          }} className="cue-contact-row">
            <Field label="Your name">
              <input
                type="text" value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex" maxLength={100}
                autoComplete="name" style={inputStyle}
              />
            </Field>
            <Field label="Email">
              <input
                type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@studio.com" maxLength={200}
                autoComplete="email" style={inputStyle}
              />
            </Field>
          </div>
          <Field label="Message">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What's on your mind?"
              required maxLength={4000} rows={6}
              style={{ ...inputStyle, resize: 'vertical', minHeight: 130, lineHeight: 1.55 }}
            />
          </Field>

          <button
            type="submit"
            disabled={sending || !message.trim()}
            style={{
              padding: '14px 20px', borderRadius: 8,
              background: (sending || !message.trim()) ? '#1c1c1e' : '#f2f2ef',
              color: (sending || !message.trim()) ? 'var(--text-dimmer)' : '#0a0a0c',
              border: 'none', cursor: (sending || !message.trim()) ? 'not-allowed' : 'pointer',
              fontSize: 13.5, fontWeight: 600, letterSpacing: '0.02em',
              fontFamily: 'var(--font-sans)',
            }}
          >
            {sending ? 'Sending…' : 'Send message'}
          </button>

          {state === 'ok' && (
            <div style={{
              fontSize: 12.5, color: '#ccff00',
              padding: '10px 12px', borderRadius: 6,
              background: 'rgba(204,255,0,0.06)',
              border: '1px solid rgba(204,255,0,0.28)',
            }}>
              Got it. I'll reply from hello@cuedesign.space within 5 business days.
            </div>
          )}
          {state === 'err' && (
            <div style={{
              fontSize: 12.5, color: '#ff6b6b',
              padding: '10px 12px', borderRadius: 6,
              background: 'rgba(255,107,107,0.06)',
              border: '1px solid rgba(255,107,107,0.28)',
            }}>{err}</div>
          )}

          <div style={{ fontSize: 10.5, color: 'var(--text-dimmer)', lineHeight: 1.6 }}>
            Your message goes to Cue's admin inbox. Read the{' '}
            <a href="#/legal/privacy" style={{ color: 'var(--text-dim)' }}>privacy policy</a>{' '}
            for how contact submissions are handled.
          </div>
        </form>
      </main>

      {/* Stack the columns on narrow screens */}
      <style>{`
        @media (max-width: 780px) {
          .cue-contact-grid { grid-template-columns: 1fr !important; gap: 40px !important; padding-top: 40px !important; }
          .cue-contact-row  { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Footer />
    </div>
  )
}

function ContactRow({ label, children }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 4 }}>
        {label}
      </div>
      <div>{children}</div>
    </div>
  )
}
function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{label}</span>
      {children}
    </label>
  )
}
function SocialPill({ href, label, icon }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
       aria-label={label}
       style={{
         width: 38, height: 38, borderRadius: 999,
         background: '#0e0e10', border: '1px solid var(--border)',
         color: 'var(--text)',
         display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
         transition: 'border-color 0.15s ease, color 0.15s ease',
       }}
       onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--electric)'; e.currentTarget.style.color = 'var(--electric)' }}
       onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text)' }}
    >
      {icon}
    </a>
  )
}
function IconX() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z"/>
    </svg>
  )
}
function IconEmail() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <path d="M3 7l9 6 9-6"/>
    </svg>
  )
}

const contactValue = { fontSize: 15, color: 'var(--text)', lineHeight: 1.5 }
const contactValueLink = { ...contactValue, textDecoration: 'none', borderBottom: '1px solid var(--border)', paddingBottom: 2 }
const inputStyle = {
  padding: '11px 13px', borderRadius: 6,
  background: '#0a0a0c', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font-sans)',
  outline: 'none', transition: 'border-color 0.15s ease',
}
