import React, { useState } from 'react'
import Footer from '../components/Footer.jsx'
import { usePageMeta } from '../hooks/usePageMeta.js'
import { supabase } from '../lib/supabase.js'
import { friendlyError } from '../lib/friendlyError.js'

/**
 * Contact page — sits at #/contact. Reachable from the footer + the
 * UserButton menu. Two-column: brand info on the left, contact form
 * on the right, both under a centered serif heading. Form pipes
 * into feedback table (source='contact-page') so admin sees it in
 * AdminInbox alongside other feedback.
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
      // send-contact edge fn handles three things at once:
      //   1. Inserts feedback row (source='contact-page')
      //   2. Emails founder at hello@cuedesign.space via Resend
      //   3. Sends an auto-acknowledgement to the customer's email
      // We invoke it instead of calling submitFeedback directly so
      // one code path covers the whole delivery flow.
      const { error } = await supabase.functions.invoke('send-contact', {
        body: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          message: message.trim(),
          source: 'contact-page',
        },
      })
      if (error) throw new Error(error.message || 'Send failed')
      setState('ok')
      setName(''); setEmail(''); setMessage('')
    } catch (e) {
      setState('err')
      setErr(friendlyError(e, "Couldn't send your message. Try again — or email hello@cuedesign.space directly."))
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{
      background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)',
      fontFamily: 'var(--font-sans)', display: 'flex', flexDirection: 'column',
    }}>
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

      <main style={{
        flex: 1, maxWidth: 1080, width: '100%',
        margin: '0 auto', padding: '72px 24px 96px',
      }}>
        {/* Centered heading */}
        <h1 style={{
          margin: '0 auto 56px',
          fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400,
          fontSize: 'clamp(30px, 4.5vw, 46px)', letterSpacing: '-0.02em',
          lineHeight: 1.15, textAlign: 'center', maxWidth: 720,
          color: 'var(--text)',
        }}>
          Get in touch, let us know<br />how we can help.
        </h1>

        {/* Two-column layout */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(240px, 1fr) minmax(320px, 1.4fr)',
          gap: 64, alignItems: 'start',
        }} className="cue-contact-grid">

          {/* Left — brand info */}
          <div>
            <InfoRow label="Email">
              <a href="mailto:hello@cuedesign.space" style={emailValueStyle}>
                hello@cuedesign.space
              </a>
            </InfoRow>

            <InfoRow label="Twitter / X">
              <a href="https://x.com/Alok619308" target="_blank" rel="noopener noreferrer" style={emailValueStyle}>
                @Alok619308
              </a>
            </InfoRow>

            {/* Colorful social pills */}
            <div style={{ marginTop: 44, display: 'flex', gap: 10 }}>
              <SocialPill
                href="https://x.com/Alok619308"
                aria="X / Twitter"
                bg="#0000FF"
              >
                <IconX />
              </SocialPill>
              <SocialPill
                href="mailto:hello@cuedesign.space"
                aria="Email"
                bg="#0000FF"
              >
                <IconEmail />
              </SocialPill>
            </div>
          </div>

          {/* Right — form */}
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
            }} className="cue-contact-row">
              <Field label="Your Name">
                <input
                  type="text" value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your full name"
                  maxLength={100} autoComplete="name"
                  style={inputStyle}
                />
              </Field>
              <Field label="Email address">
                <input
                  type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Your email address"
                  maxLength={200} autoComplete="email"
                  style={inputStyle}
                />
              </Field>
            </div>
            <Field label="Message">
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write something…"
                required maxLength={4000} rows={7}
                style={{ ...inputStyle, resize: 'vertical', minHeight: 160, lineHeight: 1.55 }}
              />
            </Field>

            <button
              type="submit"
              disabled={sending || !message.trim()}
              style={{
                marginTop: 6, padding: '15px 22px', borderRadius: 8,
                background: (sending || !message.trim()) ? 'rgba(0,0,255,0.4)' : 'var(--electric)',
                color: '#fff',
                border: 'none',
                cursor: (sending || !message.trim()) ? 'not-allowed' : 'pointer',
                fontSize: 13.5, fontWeight: 600, letterSpacing: '0.02em',
                fontFamily: 'var(--font-sans)',
                transition: 'background 0.15s ease',
              }}
            >
              {sending ? 'Sending…' : 'Send Message'}
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
          </form>
        </div>
      </main>

      <style>{`
        @media (max-width: 780px) {
          .cue-contact-grid { grid-template-columns: 1fr !important; gap: 40px !important; }
          .cue-contact-row  { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Footer />
    </div>
  )
}

function InfoRow({ label, children }) {
  return (
    <div style={{ marginBottom: 26 }}>
      <div style={{
        fontSize: 12.5, color: 'var(--text-dim)', marginBottom: 6,
      }}>
        {label}:
      </div>
      <div>{children}</div>
    </div>
  )
}
function Field({ label, children }) {
  return (
    <label style={{ display: 'grid', gap: 8 }}>
      <span style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>{label}</span>
      {children}
    </label>
  )
}
function SocialPill({ href, aria, bg, children }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" aria-label={aria}
       style={{
         width: 34, height: 34, borderRadius: 999,
         background: bg, color: '#fff',
         display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
         transition: 'opacity 0.15s ease, transform 0.15s ease',
       }}
       onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; e.currentTarget.style.transform = 'scale(1.05)' }}
       onMouseLeave={(e) => { e.currentTarget.style.opacity = '1';    e.currentTarget.style.transform = 'scale(1)' }}
    >
      {children}
    </a>
  )
}
function IconX() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117l11.966 15.644z"/>
    </svg>
  )
}
function IconEmail() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2"/>
      <path d="M3 7l9 6 9-6"/>
    </svg>
  )
}

const emailValueStyle = {
  fontSize: 16, color: 'var(--text)', fontWeight: 500,
  textDecoration: 'none', letterSpacing: '-0.005em',
  borderBottom: '1px solid transparent',
  transition: 'border-color 0.15s ease',
}
const infoValueStyle = { fontSize: 15, color: 'var(--text)', lineHeight: 1.55 }
const inputStyle = {
  padding: '13px 15px', borderRadius: 8,
  background: '#0e0e10', border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 14, fontFamily: 'var(--font-sans)',
  outline: 'none', transition: 'border-color 0.15s ease',
}
