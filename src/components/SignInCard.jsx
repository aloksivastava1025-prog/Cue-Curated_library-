import React, { useEffect, useState } from 'react'
import { useSignIn, useSignUp, useClerk, useUser } from '@clerk/clerk-react'
import { useAuth } from '../hooks/useAuth.jsx'
import { backend } from '../lib/backend.js'

/**
 * Sign-in / sign-up card, white "Genesis" look on a dim backdrop.
 * No password — Google OAuth or email OTP.
 *
 * Flow:
 *   1. Enter email → Continue
 *   2. Email captured to waitlist_emails immediately (lead-capture)
 *   3. Clerk sends 6-digit code to that email
 *   4. Card transitions to OTP entry
 *   5. Verify → session activates → close
 */

const HERO_IMAGE = 'https://i.pinimg.com/736x/3e/a6/8c/3ea68c67fa1c454c524fc225dfd2996b.jpg'

// White-card local palette (independent of CUE app dark theme).
const P = {
  bg:        '#EAEAEA',
  cardBg:    '#FFFFFF',
  text:      '#111111',
  textMuted: '#666666',
  textDim:   '#999999',
  border:    '#E8E8E8',
  inputBg:   '#F6F6F6',
  primary:   '#111111',
  danger:    '#C62828',
}
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"

// Preserves OTP state across tab switches. Cleared once auth completes
// or the user goes back to the email step. Session-scoped so it doesn't
// leak across browser sessions.
const PERSIST_KEY = 'cue.signin.pending'

function loadPending() {
  try {
    const raw = sessionStorage.getItem(PERSIST_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // Older than 20 min → invalid, Clerk code expires anyway
    if (!parsed?.ts || Date.now() - parsed.ts > 20 * 60 * 1000) {
      sessionStorage.removeItem(PERSIST_KEY)
      return null
    }
    return parsed
  } catch { return null }
}
function savePending(email, mode) {
  try {
    sessionStorage.setItem(PERSIST_KEY, JSON.stringify({ email, mode, ts: Date.now() }))
  } catch {}
}
function clearPending() {
  try { sessionStorage.removeItem(PERSIST_KEY) } catch {}
}

export default function SignInCard({ open, mode = 'sign-in', onClose }) {
  const { toggleMode } = useAuth()
  const { signIn, isLoaded: signInLoaded, setActive: setActiveSignIn } = useSignIn()
  const { signUp, isLoaded: signUpLoaded, setActive: setActiveSignUp } = useSignUp()
  const { isSignedIn, isLoaded: userLoaded } = useUser()
  const isSignIn = mode === 'sign-in'

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Restore OTP state on open — critical when user tabs away to check
  // their email and comes back. Without this the OTP screen resets to
  // the email step, which is really frustrating.
  useEffect(() => {
    if (!open) return
    // If the user is already signed in when the modal opens, there
    // is nothing left to do — close immediately and wipe any stale
    // "pending OTP" marker from a previous session. Without this
    // guard, users who successfully signed up in a prior visit come
    // back, get restored to the code screen, hit resubmit, and get
    // Clerk's "verification has already been verified" 422.
    if (userLoaded && isSignedIn) {
      clearPending()
      onClose?.()
      return
    }
    const pending = loadPending()
    // Ignore pending markers older than 10 minutes — Clerk's code
    // resource expires around then and stale markers strand users
    // on a dead OTP screen.
    const isFresh = pending?.ts && (Date.now() - pending.ts) < 10 * 60 * 1000
    if (pending?.email && pending.mode === mode && isFresh) {
      // Mid-flow — restore to OTP step
      setEmail(pending.email)
      setStep('code')
      setCode('')
      setError('')
      setBusy(false)
    } else {
      if (pending && !isFresh) clearPending()
      setEmail(''); setCode(''); setError(''); setStep('email'); setBusy(false)
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey) }
  }, [open, mode, onClose, isSignedIn, userLoaded])

  if (!open) return null

  const google = async () => {
    if (busy) return
    setError(''); setBusy(true)
    try {
      const target = isSignIn ? signIn : signUp
      if (!target) throw new Error('Getting ready — try again in a couple of seconds.')
      await target.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: window.location.origin + '/sso-callback',
        redirectUrlComplete: window.location.href,
      })
    } catch (err) {
      setBusy(false)
      setError(clerkErr(err))
    }
  }

  // X / Twitter OAuth — Clerk renamed the strategy from
  // `oauth_twitter` to `oauth_x` in 2024. New instances only accept
  // `oauth_x`; older instances that were provisioned as Twitter still
  // take the legacy name. Try `oauth_x` first, fall back to
  // `oauth_twitter` on the "does not match allowed values" error so
  // both instance vintages work.
  const xLogin = async () => {
    if (busy) return
    setError(''); setBusy(true)
    const target = isSignIn ? signIn : signUp
    if (!target) { setBusy(false); setError('Getting ready — try again in a couple of seconds.'); return }
    const tryStrategy = (strategy) => target.authenticateWithRedirect({
      strategy,
      redirectUrl: window.location.origin + '/sso-callback',
      redirectUrlComplete: window.location.href,
    })
    try {
      await tryStrategy('oauth_x')
    } catch (err) {
      const msg = String(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || '')
      if (/does not match|allowed values|invalid.*strategy/i.test(msg)) {
        try { await tryStrategy('oauth_twitter'); return } catch (err2) {
          setBusy(false); setError(clerkErr(err2)); return
        }
      }
      setBusy(false)
      setError(clerkErr(err))
    }
  }

  const submitEmail = async (e) => {
    e.preventDefault()
    if (busy) return
    const clean = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) { setError('Please enter a valid email'); return }
    setError(''); setBusy(true)

    // Lead capture — save email before OTP so we have it if user drops off.
    try { await backend.subscribeWaitlist({ email: clean, source: 'signin-attempt' }) } catch {}

    try {
      if (isSignIn) {
        if (!signInLoaded) throw new Error('Getting ready — try again in a couple of seconds.')
        await signIn.create({ identifier: clean })
        const emailFactor = signIn.supportedFirstFactors?.find((f) => f.strategy === 'email_code')
        if (!emailFactor) throw new Error('Email sign-in is warming up — try again in a moment.')
        await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: emailFactor.emailAddressId })
      } else {
        if (!signUpLoaded) throw new Error('Getting ready — try again in a couple of seconds.')
        await signUp.create({ emailAddress: clean })
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      }
      savePending(clean, mode) // persist so tab-switch doesn't lose the OTP step
      setStep('code')
    } catch (err) {
      setError(clerkErr(err))
    } finally {
      setBusy(false)
    }
  }

  const submitCode = async (e) => {
    e.preventDefault()
    if (busy || code.length < 6) return
    setError(''); setBusy(true)
    try {
      if (isSignIn) {
        const res = await signIn.attemptFirstFactor({ strategy: 'email_code', code: code.trim() })
        if (res.status === 'complete' && res.createdSessionId) {
          clearPending()
          await setActiveSignIn({ session: res.createdSessionId })
          onClose?.()
        } else {
          // Rare: second-factor required. Not enabled on our Clerk
          // instance, but surfaced defensively.
          setError('One more step needed — refresh and try signing in again.')
        }
      } else {
        const res = await signUp.attemptEmailAddressVerification({ code: code.trim() })
        // 'complete' → session created, we're done.
        // 'missing_requirements' → email verified server-side but
        //   Clerk still wants a username/first-name/etc. before
        //   activating the session. If our instance doesn't require
        //   those (typical setup), createdSessionId will exist here
        //   anyway — activate it. Otherwise, retry signUp.update({})
        //   with empty payload to nudge Clerk past the check.
        const sid = res.createdSessionId || signUp?.createdSessionId
        if (res.status === 'complete' && sid) {
          clearPending()
          await setActiveSignUp({ session: sid })
          onClose?.()
        } else if (sid) {
          // Session exists — verification actually succeeded, just
          // status didn't flip to complete. Activate anyway.
          clearPending()
          await setActiveSignUp({ session: sid })
          onClose?.()
        } else if (res.status === 'missing_requirements') {
          // Clerk instance is asking for extra fields the flow didn't
          // collect (username / first_name / last_name / password).
          // Auto-fill defaults from the email so the user never sees
          // an extra form for stuff Cue doesn't actually care about.
          try {
            const localPart = (email || '').split('@')[0] || 'user'
            const safeUsername = localPart
              .toLowerCase()
              .replace(/[^a-z0-9_]/g, '_')
              .slice(0, 30) || `user_${Date.now().toString(36)}`
            const firstName = localPart.replace(/[^a-zA-Z]/g, '') || 'there'
            // Random 20-char password Clerk accepts and user never
            // needs to know — they log in with email OTP anyway.
            const randomPassword = 'Cue-' + Math.random().toString(36).slice(2, 12)
              + '-' + Math.random().toString(36).slice(2, 12)
            const missing = Array.isArray(signUp?.missingFields) ? signUp.missingFields : []
            const payload = {}
            if (missing.includes('username'))    payload.username = safeUsername
            if (missing.includes('first_name'))  payload.firstName = firstName
            if (missing.includes('last_name'))   payload.lastName = 'User'
            if (missing.includes('password'))    payload.password = randomPassword
            // If Clerk didn't tell us what's missing, throw the
            // kitchen sink — Clerk ignores fields it doesn't need.
            const finalPayload = Object.keys(payload).length ? payload : {
              username: safeUsername,
              firstName: firstName,
              lastName: 'User',
              password: randomPassword,
            }
            const upd = await signUp.update(finalPayload)
            const usid = upd?.createdSessionId || signUp?.createdSessionId
            if (usid) {
              clearPending()
              await setActiveSignUp({ session: usid })
              onClose?.()
              return
            }
          } catch (_) { /* fall through */ }
          setError("Almost there — refresh once and you'll be signed in.")
        } else {
          setError('Verification incomplete. Try again.')
        }
      }
    } catch (err) {
      // "Verification has already been verified" fires when a code
      // was accepted seconds earlier (double-click, autofill + Enter,
      // React re-submit, tab focus race) and the second call sees a
      // completed state. Treat it as success — try to finalise the
      // sign-in/sign-up we already have, and close the modal.
      const rawMsg = String(err?.errors?.[0]?.longMessage || err?.errors?.[0]?.message || err?.message || '')
      const alreadyVerified =
        /verification.*already.*verified/i.test(rawMsg)
        || /already.*been.*verified/i.test(rawMsg)
        || err?.errors?.[0]?.code === 'verification_already_verified'
      if (alreadyVerified) {
        try {
          const sid = (isSignIn ? signIn?.createdSessionId : signUp?.createdSessionId)
          if (sid) {
            clearPending()
            if (isSignIn) await setActiveSignIn({ session: sid })
            else await setActiveSignUp({ session: sid })
            onClose?.()
            return
          }
        } catch (_) { /* fall through — show a friendly error */ }
        // Session id unavailable — clear pending so the user can
        // just close the modal and refresh into their signed-in
        // state instead of hitting the error again.
        clearPending()
        setError("You're already verified — close this and refresh.")
        return
      }
      setError(clerkErr(err))
    } finally {
      setBusy(false)
    }
  }

  const resendCode = async () => {
    if (busy) return
    setError(''); setBusy(true)
    try {
      if (isSignIn) {
        const emailFactor = signIn.supportedFirstFactors?.find((f) => f.strategy === 'email_code')
        if (emailFactor) await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: emailFactor.emailAddressId })
      } else {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' })
      }
    } catch (err) { setError(clerkErr(err)) } finally { setBusy(false) }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(0,0,0,0.60)',
        backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, animation: 'cueAuthBackdrop 500ms ease-out both',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        data-lenis-prevent
        style={{
          width: '100%', maxWidth: 420,
          background: P.cardBg,
          borderRadius: 32, padding: 10, boxSizing: 'border-box',
          boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
          fontFamily: FONT,
          animation: 'cueAuthPop 720ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
          transformOrigin: '50% 100%',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 14, right: 14,
            width: 30, height: 30, borderRadius: 999,
            background: 'transparent', color: P.textDim,
            border: 'none', cursor: 'pointer', fontSize: 22, lineHeight: 1, zIndex: 2,
          }}
        >×</button>

        {/* Hero image with mask fade */}
        <div style={{
          width: '100%', height: 200, borderRadius: '24px 24px 0 0', overflow: 'hidden',
          position: 'relative',
          WebkitMaskImage: 'linear-gradient(to bottom, black 60%, transparent 100%)',
          maskImage:         'linear-gradient(to bottom, black 60%, transparent 100%)',
        }}>
          <img src={HERO_IMAGE} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>

        <div style={{ padding: '12px 16px 20px' }}>
          <h1 style={{
            margin: '0 0 10px', fontSize: 22, fontWeight: 600, lineHeight: 1.3,
            letterSpacing: '-0.02em', color: P.text,
          }}>
            {step === 'code'
              ? <>Check your email,<br />enter the code to finish.</>
              : isSignIn
                ? <>Welcome back,<br />Login to your account!</>
                : <>Join Cue,<br />Create your account.</>
            }
          </h1>
          <p style={{ margin: '0 0 20px', fontSize: 13, color: P.textMuted, fontWeight: 500 }}>
            {step === 'code' ? `We sent a 6-digit code to ${email}.` : 'Enter your details to proceed'}
          </p>

          {step === 'email' ? (
            <>
              {/* Google */}
              <button
                type="button"
                onClick={google}
                disabled={busy || !signInLoaded || !signUpLoaded}
                style={{
                  background: '#fff', color: P.text, border: `1px solid ${P.border}`,
                  borderRadius: 24, padding: 14, fontSize: 14, fontWeight: 500,
                  width: '100%',
                  cursor: (busy || !signInLoaded || !signUpLoaded) ? 'not-allowed' : 'pointer',
                  opacity: (!signInLoaded || !signUpLoaded) ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  marginBottom: 16, fontFamily: 'inherit',
                  transition: 'background 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease',
                }}
                onMouseEnter={(e) => { if (!busy && signInLoaded && signUpLoaded) { e.currentTarget.style.background = '#FAFAFA'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)' } }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {(!signInLoaded || !signUpLoaded) ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ animation: 'cue-signin-spin 700ms linear infinite' }}>
                      <circle cx="12" cy="12" r="9" stroke="rgba(0,0,0,0.15)" strokeWidth="3" fill="none" />
                      <path d="M12 3a9 9 0 0 1 9 9" stroke="#4285F4" strokeWidth="3" fill="none" strokeLinecap="round" />
                    </svg>
                    Loading sign-in…
                  </>
                ) : busy ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ animation: 'cue-signin-spin 700ms linear infinite' }}>
                      <circle cx="12" cy="12" r="9" stroke="rgba(0,0,0,0.15)" strokeWidth="3" fill="none" />
                      <path d="M12 3a9 9 0 0 1 9 9" stroke="#4285F4" strokeWidth="3" fill="none" strokeLinecap="round" />
                    </svg>
                    Redirecting to Google…
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    Continue with Google
                  </>
                )}
              </button>

              {/* X / Twitter OAuth — same visual system as Google
                  button. Uses the xLogin handler which invokes
                  Clerk's oauth_twitter strategy. */}
              <button
                type="button"
                onClick={xLogin}
                disabled={busy || !signInLoaded || !signUpLoaded}
                style={{
                  background: '#000', color: '#fff', border: '1px solid #000',
                  borderRadius: 24, padding: 14, fontSize: 14, fontWeight: 500,
                  width: '100%',
                  cursor: (busy || !signInLoaded || !signUpLoaded) ? 'not-allowed' : 'pointer',
                  opacity: (!signInLoaded || !signUpLoaded) ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  marginBottom: 16, fontFamily: 'inherit',
                  transition: 'background 0.15s ease, box-shadow 0.15s ease, opacity 0.2s ease',
                }}
                onMouseEnter={(e) => { if (!busy && signInLoaded && signUpLoaded) { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)' } }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#000'; e.currentTarget.style.boxShadow = 'none' }}
              >
                {(!signInLoaded || !signUpLoaded) ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ animation: 'cue-signin-spin 700ms linear infinite' }}>
                      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.25)" strokeWidth="3" fill="none" />
                      <path d="M12 3a9 9 0 0 1 9 9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
                    </svg>
                    Loading sign-in…
                  </>
                ) : busy ? (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" style={{ animation: 'cue-signin-spin 700ms linear infinite' }}>
                      <circle cx="12" cy="12" r="9" stroke="rgba(255,255,255,0.25)" strokeWidth="3" fill="none" />
                      <path d="M12 3a9 9 0 0 1 9 9" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />
                    </svg>
                    Redirecting to X…
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    Continue with X
                  </>
                )}
              </button>
              <style>{`@keyframes cue-signin-spin { to { transform: rotate(360deg); } }`}</style>

<div style={{ display: 'flex', alignItems: 'center', textAlign: 'center', marginBottom: 16, color: '#AAAAAA', fontSize: 12, fontWeight: 500 }}>
                <span style={{ flex: 1, borderBottom: `1px solid ${P.border}` }} />
                <span style={{ padding: '0 14px' }}>or</span>
                <span style={{ flex: 1, borderBottom: `1px solid ${P.border}` }} />
              </div>

              <form onSubmit={submitEmail}>
                <InputRow
                  icon={
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                      <polyline points="22,6 12,13 2,6" />
                    </svg>
                  }
                  label="Email Address"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="hello@example.com"
                  autoComplete="email"
                  marginBottom={24}
                />

                {error && <ErrorRow msg={error} />}
                <PrimaryButton disabled={busy}>{busy ? 'Sending code…' : 'Continue'}</PrimaryButton>
              </form>

              <div style={{ marginTop: 14, textAlign: 'center', fontSize: 12.5, color: P.textMuted }}>
                {isSignIn ? "Don't have an account? " : 'Already have an account? '}
                <button
                  type="button" onClick={toggleMode}
                  style={{ background: 'transparent', border: 'none', color: '#3D50E8', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  {isSignIn ? 'Sign up' : 'Sign in'}
                </button>
              </div>
            </>
          ) : (
            /* ---------- OTP step ---------- */
            <form onSubmit={submitCode}>
              <InputRow
                icon={
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                }
                label="6-digit code"
                value={code}
                onChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                autoFocus
                marginBottom={24}
              />
              {error && <ErrorRow msg={error} />}
              <PrimaryButton disabled={busy || code.length < 6}>
                {busy ? 'Verifying…' : (isSignIn ? 'Sign In' : 'Create account')}
              </PrimaryButton>

              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, color: P.textMuted }}>
                <button type="button" onClick={() => { clearPending(); setStep('email'); setCode('') }} style={{ background: 'transparent', border: 'none', color: P.textMuted, fontSize: 12, cursor: 'pointer', padding: 0 }}>
                  ← Use a different email
                </button>
                <button type="button" onClick={resendCode} disabled={busy} style={{ background: 'transparent', border: 'none', color: '#3D50E8', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                  Resend code
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <style>{`
        /* Card pop — starts small + tilted from the bottom, springs up to
           center with a slight overshoot + rotation wobble, then settles.
           Longer duration + cubic-bezier(.34, 1.56, .64, 1) gives it
           that "toy-like" fun feel instead of a flat sudden reveal. */
        @keyframes cueAuthPop {
          0%   { transform: translateY(90px) scale(0.55) rotate(-4deg); opacity: 0; }
          25%  { opacity: 1; }
          55%  { transform: translateY(-10px) scale(1.04) rotate(1.5deg); }
          75%  { transform: translateY(3px)   scale(0.99) rotate(-0.5deg); }
          100% { transform: translateY(0)     scale(1)    rotate(0);      opacity: 1; }
        }
        /* Backdrop fades in over ~half the card animation so the eye
           lands on the card first, not the darkening. */
        @keyframes cueAuthBackdrop {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* Stagger the content elements so the card feels alive: hero
           pops first, then title, then form. Each staggers ~60ms. */
        @keyframes cueAuthStagger {
          0%   { transform: translateY(6px); opacity: 0; }
          100% { transform: translateY(0);   opacity: 1; }
        }
      `}</style>
    </div>
  )
}

function InputRow({ icon, label, value, onChange, placeholder, type = 'text', autoComplete, autoFocus, marginBottom = 16 }) {
  return (
    <div style={{ marginBottom, display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: P.text, marginBottom: 10 }}>{label}</div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <span style={{ position: 'absolute', left: 16, color: P.textDim, display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
          {icon}
        </span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          autoFocus={autoFocus}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: P.inputBg, border: `1px solid ${P.inputBg}`,
            borderRadius: 24, padding: '14px 16px 14px 42px',
            fontSize: 14, fontFamily: 'inherit', color: P.text,
            outline: 'none', transition: 'border-color 0.15s ease, background 0.15s ease',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = '#D0D0D0'; e.currentTarget.style.background = '#fff' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = P.inputBg; e.currentTarget.style.background = P.inputBg }}
        />
      </div>
    </div>
  )
}

function PrimaryButton({ disabled, children }) {
  return (
    <button
      type="submit" disabled={disabled}
      style={{
        background: disabled ? '#888' : P.primary,
        color: '#fff',
        border: 'none', borderRadius: 24,
        padding: 16, fontSize: 14, fontWeight: 500,
        width: '100%', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease',
      }}
      onMouseEnter={(e) => { if (!disabled) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 20px rgba(0,0,0,0.15)'; e.currentTarget.style.background = '#000' } }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.background = disabled ? '#888' : P.primary }}
    >{children}</button>
  )
}

function ErrorRow({ msg }) {
  return (
    <div style={{
      padding: '9px 12px', marginBottom: 12,
      background: 'rgba(198,40,40,0.08)', border: '1px solid rgba(198,40,40,0.28)',
      borderRadius: 10, fontSize: 12.5, color: P.danger, lineHeight: 1.4,
    }}>{msg}</div>
  )
}

function clerkErr(err) {
  const first = err?.errors?.[0]
  const raw = first?.longMessage || first?.message || err?.message || ''
  const lower = raw.toLowerCase()

  // User-friendly translations for known Clerk / network / SDK errors —
  // avoids leaking "Clerk", "Edge Function", stack traces, or codes.
  if (!raw) return "Something went wrong — try again."
  if (/failed_to_load_clerk|failed to load clerk|not ready|not yet loaded|initializ/i.test(raw)) {
    return "Getting ready — try again in a couple of seconds."
  }
  if (/timeout|timed out/i.test(lower)) {
    return "Network's slow — try again in a moment."
  }
  if (/network|offline|failed to fetch|internet/i.test(lower)) {
    return "Connection hiccup — check your internet and try again."
  }
  if (/rate limit|too many|429/i.test(lower)) {
    return "Too many attempts — please wait a minute and try again."
  }
  if (/invalid.*code|incorrect.*code|verification.*failed/i.test(lower)) {
    return "That code doesn't match. Check your email and try again."
  }
  if (/invalid.*email|malformed/i.test(lower)) {
    return "That doesn't look like a valid email — please check it."
  }
  if (/already.*exist|already.*used|taken/i.test(lower)) {
    return "This email is already registered — try signing in instead."
  }
  if (/not.*found|no.*account/i.test(lower)) {
    return "No account found with that email — try signing up."
  }
  if (/password.*incorrect|invalid.*credential/i.test(lower)) {
    return "That password doesn't match. Try again."
  }
  if (/oauth|social|google|apple|twitter|\bx\b/i.test(lower) && /error|fail|denied/i.test(lower)) {
    return "Social sign-in didn't complete — try again or use email."
  }
  // Final safety: never surface anything with "clerk" or a stack trace.
  if (/clerk|error:|at .*\(/i.test(raw)) {
    return "Something didn't work — try again in a moment."
  }
  return raw
}
