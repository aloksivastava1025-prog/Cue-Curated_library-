// ============================================================
// Cue — get the caller's plan (JWT-verified)
// ============================================================
// The client used to read user_profiles.plan directly via the
// anon Supabase client, which meant tight RLS on that table
// blanked out the row for the very users who owned it. Route
// plan reads through this fn: verify the Clerk JWT, service-role
// read the row, hand back a small { plan, source, expires_at }
// payload.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { verifyClerkJwt, authErrorResponse } from '../_shared/clerk.ts'

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5175',
  'http://localhost:5180',
  'http://localhost:5230',
  'https://cuedesign.space',
  'https://www.cuedesign.space',
]

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

serve(async (req) => {
  const headers = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers })

  let sub = ''
  let email = ''
  try {
    const claims = await verifyClerkJwt(req)
    sub = claims.sub
    email = (claims.email || '').toLowerCase()
  } catch (err) {
    return authErrorResponse(err, headers)
  }

  try {
    const supa = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    )

    // Primary lookup — Clerk sub → user_profiles.user_id.
    // Fallback — email match. Multiple rows can exist for the same
    // email (reconciled sign-ups). Pick the highest-tier row so a
    // paying customer never sees "free" even if their newest Clerk
    // session lands on an unpaid row.
    let { data: row } = await supa
      .from('user_profiles')
      .select('plan, plan_source, plan_started_at, plan_expires_at, email, user_id')
      .eq('user_id', sub)
      .maybeSingle()

    if (!row && email) {
      const { data: byEmail } = await supa
        .from('user_profiles')
        .select('plan, plan_source, plan_started_at, plan_expires_at, email, user_id')
        .ilike('email', email)
      if (Array.isArray(byEmail) && byEmail.length > 0) {
        // Prefer any cue_plus / team row over free.
        row = byEmail.find((r) => r.plan === 'cue_plus_team')
          || byEmail.find((r) => r.plan === 'cue_plus')
          || byEmail[0]
      }
    }

    if (!row) {
      return new Response(JSON.stringify({ plan: 'free' }), {
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Enforce expiry — a lifetime row has plan_expires_at = null.
    if (row.plan_expires_at && new Date(row.plan_expires_at) < new Date()) {
      return new Response(JSON.stringify({ plan: 'free' }), {
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      plan: row.plan,
      plan_source: row.plan_source,
      plan_started_at: row.plan_started_at,
      plan_expires_at: row.plan_expires_at,
    }), { headers: { ...headers, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ plan: 'free', error: (err as Error).message }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }
})
