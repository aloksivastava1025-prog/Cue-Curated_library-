import { useEffect, useState, useCallback } from 'react'
import { useUser } from '@clerk/clerk-react'
import { backend } from '../lib/backend.js'

/**
 * Decides whether to show the onboarding card.
 * Trigger conditions (all must hold):
 *   1. User is signed in
 *   2. Their user_profiles row has onboarded_at IS NULL
 *   3. We haven't already shown-and-closed this session
 *
 * Also: silently ensures a user_profiles row exists on sign-in (idempotent).
 */
export function useOnboarding() {
  const { user, isSignedIn, isLoaded } = useUser()
  const [profile, setProfile] = useState(null)
  const [checking, setChecking] = useState(true)
  const [dismissedThisSession, setDismissedThisSession] = useState(false)

  useEffect(() => {
    if (!isLoaded) return
    if (!isSignedIn) { setProfile(null); setChecking(false); return }

    let alive = true
    setChecking(true)
    ;(async () => {
      try {
        // Ensure a row exists (client-side sync — Option A from earlier discussion)
        await backend.ensureUserProfile(user)
        const p = await backend.getMyProfile(user.id)
        if (alive) setProfile(p)
      } finally {
        if (alive) setChecking(false)
      }
    })()
    return () => { alive = false }
  }, [isSignedIn, isLoaded, user?.id])

  const dismiss = useCallback(() => setDismissedThisSession(true), [])

  const complete = useCallback(async () => {
    setDismissedThisSession(true)
    // Refresh profile so the app has the new display_name / avatar_url
    if (user?.id) {
      const p = await backend.getMyProfile(user.id)
      setProfile(p)
    }
  }, [user?.id])

  const shouldShow = Boolean(
    isSignedIn &&
    !checking &&
    profile &&
    !profile.onboarded_at &&
    !dismissedThisSession
  )

  return { shouldShow, profile, dismiss, complete }
}
