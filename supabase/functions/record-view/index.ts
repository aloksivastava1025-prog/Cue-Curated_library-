// ============================================================
// CUE v2.0 — Record View (Production-Hardened)
// ============================================================
// §3.5 — Replaces the anon-callable increment_view RPC.
// Views are deduped by a composite PK in prompt_views
// (prompt_id, viewer_key, viewed_on). The DB itself rejects
// a second count for the same viewer/day.
//
// viewer_key = hash of IP + user-agent (or Clerk user_id if signed in).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

// §4.4 — CORS allow-list
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5230',
  'https://usecue.com',
  'https://www.usecue.com',
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

// Generate a viewer key from IP + user-agent (or user ID).
// This is a SHA-256 hash so we don't store raw IPs.
async function viewerKey(req: Request): Promise<string> {
  // Try to extract Clerk user ID from JWT if present.
  const authHeader = req.headers.get('Authorization')
  if (authHeader) {
    try {
      const token = authHeader.replace('Bearer ', '')
      const payload = JSON.parse(atob(token.split('.')[1]))
      if (payload.sub) return `user:${payload.sub}`
    } catch { /* fall through to IP-based */ }
  }

  // For anonymous visitors: hash IP + user-agent.
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
  const ua = req.headers.get('user-agent') || ''
  const raw = `${ip}:${ua}`

  // SHA-256 hash to avoid storing raw PII.
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `anon:${hex.slice(0, 32)}`
}

serve(async (req) => {
  const headers = corsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await req.json()
    const promptId = body?.prompt_id

    // §4.5 — Input validation
    if (!promptId || typeof promptId !== 'string' || promptId.length > 20) {
      return new Response(JSON.stringify({ error: 'Invalid prompt_id' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const vk = await viewerKey(req)

    // Use service role to bypass RLS (prompt_views has no client policies).
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Call the safe increment function. It handles dedup internally
    // via the composite PK and returns whether a new view was counted.
    const { data: counted, error } = await supabase.rpc('increment_view_safe', {
      p_prompt_id: promptId,
      p_viewer_key: vk,
    })

    if (error) {
      // If the function doesn't exist yet (DB not migrated), fall back
      // to the old increment_view for backward compatibility.
      if (/does not exist|not found/i.test(error.message || '')) {
        try {
          await supabase.rpc('increment_view', { pid: promptId })
        } catch { /* swallow */ }
        return new Response(JSON.stringify({ counted: true, fallback: true }), {
          status: 200,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }
      console.error(JSON.stringify({
        service: 'record-view', level: 'error',
        msg: 'increment_view_safe failed', error: error.message,
      }))
    }

    return new Response(JSON.stringify({ counted: !!counted }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    console.error(JSON.stringify({
      service: 'record-view', level: 'error',
      msg: 'Unhandled error', error: err.message,
    }))
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
