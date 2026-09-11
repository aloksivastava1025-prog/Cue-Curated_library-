import React, { useEffect, useRef, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { backend } from '../lib/backend.js'
import { friendlyError } from '../lib/friendlyError.js'

/**
 * First-time onboarding card. Shown once after Clerk sign-in, before the
 * user lands in CUE, so they can pick a display name and upload a photo.
 *
 * Visual: dark card floating over a dimmed backdrop. Hero image at top,
 * then avatar upload row, display name input, Continue button. Pop-in
 * animation on mount for the "fun way" moment.
 */
const HERO_GRADIENT = 'radial-gradient(120% 100% at 20% 10%, #6a5cff 0%, #3D50E8 40%, #ff5e93 70%, #ffb84a 100%)'

export default function OnboardingCard({ open, onClose, onComplete }) {
  const { user } = useUser()
  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  useEffect(() => {
    if (!open) return
    setDisplayName(user?.firstName || '')
    setAvatarUrl(user?.imageUrl || '')
    setError('')
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open, user])

  if (!open) return null

  const pickFile = () => fileRef.current?.click()

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(''); setUploading(true)
    try {
      const url = await backend.uploadAvatar(user.id, file)
      setAvatarUrl(url)
    } catch (err) {
      setError(friendlyError(err, "Couldn't upload the photo. Tap again in a moment."))
    } finally {
      setUploading(false)
    }
  }

  const submit = async (e) => {
    e.preventDefault()
    if (saving) return
    const clean = displayName.trim()
    if (!clean) { setError('Pick a display name'); return }
    if (clean.length < 2) { setError('Display name must be at least 2 characters'); return }
    if (clean.length > 30) { setError('Display name is a bit long — keep it under 30'); return }
    setSaving(true); setError('')
    try {
      await backend.updateMyProfile(user.id, {
        display_name: clean,
        avatar_url: avatarUrl || null,
        onboarded_at: new Date().toISOString(),
      })
      onComplete?.()
    } catch (err) {
      setError(friendlyError(err, "Couldn't save just now. Tap Continue again."))
      setSaving(false)
    }
  }

  const skip = async () => {
    if (saving) return
    setSaving(true)
    try {
      // Mark onboarded even without a display name — user opted out.
      // A fallback name is set from Clerk data so mentions still work.
      const fallback = user?.firstName || user?.primaryEmailAddress?.emailAddress?.split('@')[0] || 'friend'
      await backend.updateMyProfile(user.id, {
        display_name: fallback,
        onboarded_at: new Date().toISOString(),
      })
      onComplete?.()
    } catch {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.78)',
        backdropFilter: 'blur(4px)',
        WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
        animation: 'cueOnbBackdrop 260ms ease-out',
      }}
    >
      <div
        data-lenis-prevent
        style={{
          width: '100%', maxWidth: 440,
          background: '#0e0e10',
          border: '1px solid var(--border)',
          borderRadius: 28,
          padding: 10,
          boxShadow: '0 40px 100px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.03)',
          fontFamily: 'var(--font-sans)',
          position: 'relative',
          animation: 'cueOnbPop 380ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        }}
      >
        {/* Hero image — colorful gradient warms the dark card */}
        <div style={{
          width: '100%', height: 200, borderRadius: '20px 20px 0 0',
          overflow: 'hidden',
          background: HERO_GRADIENT,
          WebkitMaskImage: 'linear-gradient(to bottom, black 65%, transparent 100%)',
          maskImage:         'linear-gradient(to bottom, black 65%, transparent 100%)',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(60% 40% at 80% 90%, rgba(0,0,0,0.35), transparent)',
          }} />
        </div>

        {/* Content */}
        <div style={{ padding: '6px 20px 22px' }}>
          <h1 style={{
            margin: '0 0 8px', fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em',
            color: 'var(--text)', lineHeight: 1.25,
            fontFamily: 'var(--font-serif)', fontStyle: 'italic',
          }}>
            Welcome to Cue.<br />You're in.
          </h1>
          <p style={{ margin: '0 0 22px', fontSize: 13, color: 'var(--text-dim)' }}>
            Add a photo and pick a display name — takes 10 seconds.
          </p>

          {/* Upload row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            border: '1px solid var(--border)', borderRadius: 14,
            padding: 10, marginBottom: 18,
            background: '#0b0b0d',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 999, overflow: 'hidden',
              background: avatarUrl ? '#000' : 'linear-gradient(135deg, rgba(61,80,232,0.3), rgba(204,255,0,0.25))',
              border: '1px solid var(--border)', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" style={{ color: 'var(--text-dim)' }}>
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>Your photo</div>
              <div style={{ fontSize: 10.5, color: 'var(--text-dim)', lineHeight: 1.3 }}>
                PNG or JPEG up to 5MB<br />Square works best (500×500)
              </div>
            </div>
            <button
              type="button"
              onClick={pickFile}
              disabled={uploading}
              style={{
                background: uploading ? '#1c1c1e' : '#fff',
                color: uploading ? 'var(--text-dim)' : '#0a0a0a',
                border: 'none', borderRadius: 20,
                padding: '7px 14px',
                fontSize: 11.5, fontWeight: 500,
                cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontFamily: 'var(--font-sans)',
                transition: 'transform 0.15s ease',
              }}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <line x1="12" y1="9" x2="12" y2="17" />
                <line x1="8"  y1="13" x2="16" y2="13" />
              </svg>
              {uploading ? 'Uploading' : 'Upload'}
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={handleFile} />
          </div>

          {/* Display name */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text)', marginBottom: 8 }}>Display name</div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)', fontSize: 14, fontWeight: 500, pointerEvents: 'none' }}>@</span>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30))}
                placeholder="username"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '13px 14px 13px 34px',
                  background: '#0b0b0d',
                  border: '1px solid var(--border)', borderRadius: 20,
                  fontSize: 14, color: 'var(--text)',
                  fontFamily: 'var(--font-sans)', outline: 'none',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(61,80,232,0.45)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
              />
            </div>
          </div>

          {error && (
            <div style={{ padding: '9px 12px', marginBottom: 14, background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.28)', borderRadius: 8, fontSize: 12.5, color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={saving}
            style={{
              width: '100%', padding: 14, borderRadius: 22,
              background: saving ? '#1c1c1e' : 'var(--electric)',
              color: saving ? 'var(--text-dim)' : '#fff',
              border: 'none', cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 14, fontWeight: 500, letterSpacing: '0.01em',
              fontFamily: 'var(--font-sans)',
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              boxShadow: saving ? 'none' : '0 8px 24px -8px rgba(61,80,232,0.5)',
            }}
            onMouseEnter={(e) => { if (!saving) e.currentTarget.style.transform = 'translateY(-1px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)' }}
          >
            {saving ? 'Saving…' : 'Continue'}
          </button>

          <button
            type="button"
            onClick={skip}
            disabled={saving}
            style={{
              width: '100%', marginTop: 10, padding: '10px 0',
              background: 'transparent', border: 'none',
              color: 'var(--text-dim)', fontSize: 12, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
            }}
          >
            Skip for now
          </button>
        </div>
      </div>

      <style>{`
        @keyframes cueOnbPop {
          0%   { transform: translateY(20px) scale(0.94); opacity: 0; }
          60%  { transform: translateY(-4px) scale(1.02); opacity: 1; }
          100% { transform: translateY(0)    scale(1);    opacity: 1; }
        }
        @keyframes cueOnbBackdrop {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
