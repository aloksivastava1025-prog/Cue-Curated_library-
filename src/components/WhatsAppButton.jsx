import React, { useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { useAuth } from '../hooks/useAuth.jsx'

/**
 * WhatsApp direct-message button.
 *
 * Signed-in users → wa.me link opens with a prefilled greeting that
 * mentions their email so Alok can map the sender to a Cue account
 * from the WhatsApp chat window (no separate CRM lookup).
 *
 * Signed-out users → open the Clerk sign-in modal with the tooltip
 * "Sign in to unlock direct WhatsApp support." This is the whole
 * point of the feature — the login gate keeps spammers and bots
 * out without exposing the number publicly.
 *
 * Number lives in VITE_WHATSAPP_NUMBER so it can be swapped without
 * a code change (rotate business number, upgrade to Business API,
 * etc.). Format: international, no spaces or plus sign — e.g.
 * "91XXXXXXXXXX".
 *
 * Set VITE_WHATSAPP_ENABLED=false to hide the button everywhere
 * without a redeploy.
 */
export default function WhatsAppButton({
  variant = 'chip',          // 'chip' | 'icon' | 'inline'
  label = 'WhatsApp Alok',
  style,
}) {
  const number = String(import.meta.env.VITE_WHATSAPP_NUMBER || '').trim()
  const enabled = String(import.meta.env.VITE_WHATSAPP_ENABLED ?? 'true') !== 'false'
  const { isSignedIn, user } = useUser()
  const { openAuth } = useAuth()
  const [hovered, setHovered] = useState(false)

  if (!enabled || !number) return null

  const email = user?.primaryEmailAddress?.emailAddress
    || user?.emailAddresses?.[0]?.emailAddress
    || ''
  const name = user?.firstName || (email ? email.split('@')[0] : 'a Cue member')

  const handleClick = () => {
    if (!isSignedIn) {
      // Trigger Clerk sign-in modal. The tooltip on hover has
      // already told them why — this is one click to unlock.
      openAuth('sign-in')
      return
    }
    const greeting = `Hey Alok — ${name} here (${email}) from Cue. Quick question:`
    const url = `https://wa.me/${number}?text=${encodeURIComponent(greeting)}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const tooltip = isSignedIn
    ? 'Message Alok directly on WhatsApp'
    : 'Sign in to unlock direct WhatsApp support'

  const green = '#25D366'

  if (variant === 'icon') {
    return (
      <button
        type="button"
        aria-label={tooltip}
        title={tooltip}
        onClick={handleClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          width: 36, height: 36, borderRadius: 999,
          border: '1px solid var(--border)',
          background: hovered ? 'rgba(37,211,102,0.14)' : 'transparent',
          color: hovered ? green : 'var(--text)',
          cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          transition: 'background 160ms ease, color 160ms ease',
          ...style,
        }}
      >
        <WhatsAppIcon />
      </button>
    )
  }

  if (variant === 'inline') {
    return (
      <button
        type="button"
        onClick={handleClick}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: green, fontSize: 12.5, fontWeight: 500,
          padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: 6,
          ...style,
        }}
      >
        <WhatsAppIcon size={14} /> {isSignedIn ? label : 'Sign in for WhatsApp support'}
      </button>
    )
  }

  // Default: chip
  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={tooltip}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        padding: '8px 14px', borderRadius: 999,
        background: hovered ? green : 'rgba(37,211,102,0.10)',
        color: hovered ? '#fff' : green,
        border: `1px solid ${hovered ? green : 'rgba(37,211,102,0.35)'}`,
        fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.005em',
        cursor: 'pointer',
        transition: 'background 160ms ease, color 160ms ease, border-color 160ms ease',
        fontFamily: 'inherit',
        ...style,
      }}
    >
      <WhatsAppIcon size={14} />
      {isSignedIn ? label : 'Sign in for direct WhatsApp'}
    </button>
  )
}

function WhatsAppIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.966-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.174.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413" />
    </svg>
  )
}
