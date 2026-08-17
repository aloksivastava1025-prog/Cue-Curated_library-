import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

// Opt-in Clerk → Supabase JWT bridge. OFF by default because it requires:
//   1. A `supabase` JWT template configured in the Clerk dashboard, AND
//   2. That same signing key registered in the target Supabase project's
//      JWT settings.
// Without both sides matching, PostgREST rejects the request with
// "No suitable key or wrong key type" — even for a plain SELECT.
//
// For local testing on a fresh Supabase project, leave this off — the
// anon key + permissive RLS policies handle everything.
//
// Turn it on for production by setting VITE_USE_CLERK_SUPABASE_JWT=true
// AFTER wiring the JWT template on both sides.
const useClerkJwt = String(import.meta.env.VITE_USE_CLERK_SUPABASE_JWT || '').toLowerCase() === 'true'

export const supabase = url && key
  ? createClient(url, key, useClerkJwt ? {
      global: {
        fetch: async (fetchUrl, options = {}) => {
          let clerkToken = null
          if (typeof window !== 'undefined' && window.Clerk && window.Clerk.session) {
            try {
              clerkToken = await window.Clerk.session.getToken({ template: 'supabase' })
            } catch (e) {
              console.warn('Failed to get Clerk Supabase token', e)
            }
          }
          const headers = new Headers(options.headers)
          if (clerkToken) headers.set('Authorization', `Bearer ${clerkToken}`)
          return fetch(fetchUrl, { ...options, headers })
        }
      }
    } : undefined)
  : null

export const isSupabaseConfigured = Boolean(supabase)
