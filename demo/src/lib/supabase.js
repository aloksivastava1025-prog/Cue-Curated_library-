import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = url && key ? createClient(url, key, {
  global: {
    fetch: async (fetchUrl, options = {}) => {
      // If Clerk is available on window, grab the token dynamically
      let clerkToken = null
      if (typeof window !== 'undefined' && window.Clerk && window.Clerk.session) {
        try {
          clerkToken = await window.Clerk.session.getToken({ template: 'supabase' })
        } catch (e) {
          console.warn('Failed to get Clerk Supabase token', e)
        }
      }
      
      const headers = new Headers(options.headers)
      if (clerkToken) {
        headers.set('Authorization', `Bearer ${clerkToken}`)
      }
      
      return fetch(fetchUrl, { ...options, headers })
    }
  }
}) : null

export const isSupabaseConfigured = Boolean(supabase)
