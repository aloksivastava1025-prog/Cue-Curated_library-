// ============================================================
// CUE — Admin: grant / revoke a single-component unlock
// ============================================================
// Safety net for the "Request this component — $20" flow. If the
// dodo-webhook couldn't auto-attribute a payment (missing metadata,
// buyer not signed in yet, webhook signature failure, etc), Alok
// uses the admin panel to grant access by (email, component_id).
//
// This function looks up user_id by email in user_profiles and
// upserts a row in user_component_grants using the service-role
// key. It also handles removal (refund flow).
//
// Auth: Clerk admin via verifyClerkAdmin (same posture as every
// other admin-only edge function in this project).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { verifyClerkAdmin, authErrorResponse } from '../_shared/clerk.ts'

const ALLOWED_ORIGINS = [
  'https://cuedesign.space',
  'https://www.cuedesign.space',
]

// Prod hosts + any localhost port (Vite autoPort).
function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
  const allowed = ALLOWED_ORIGINS.includes(origin) || isLocal ? origin : ALLOWED_ORIGINS[0]
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

  try {
    await verifyClerkAdmin(req)
  } catch (err) {
    return authErrorResponse(err, headers)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body?.action || 'grant').toLowerCase() // 'grant' | 'revoke'
    const email  = String(body?.email || '').trim().toLowerCase().slice(0, 320)
    const componentId = String(body?.componentId || '').trim().slice(0, 32)
    const dodoPaymentId = String(body?.dodoPaymentId || '').trim().slice(0, 128) || null
    const amountUsd = body?.amountUsd != null ? Number(body.amountUsd) : null
    const notes = String(body?.notes || '').trim().slice(0, 1000) || null

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }
    if (!componentId) {
      return new Response(JSON.stringify({ error: 'componentId required' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Resolve user_id by email. Fall back to the same self-heal
    // anchor the webhook uses so a not-yet-signed-in buyer still
    // gets a grant that ensureUserProfile will later merge.
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('user_id, dodo_customer_id')
      .eq('email', email)
      .maybeSingle()
    const userId = profile?.user_id
      || (profile?.dodo_customer_id ? `dodo:${profile.dodo_customer_id}` : `email:${email}`)

    if (action === 'revoke') {
      const { error, count } = await supabase
        .from('user_component_grants')
        .delete({ count: 'exact' })
        .eq('user_id', userId)
        .eq('component_id', componentId)
      if (error) throw error
      return new Response(JSON.stringify({ ok: true, revoked: count || 0, user_id: userId, component_id: componentId }), {
        status: 200, headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Default: grant (upsert — idempotent on user + component).
    const { error } = await supabase
      .from('user_component_grants')
      .upsert({
        user_id: userId,
        component_id: componentId,
        granted_via: 'manual',
        dodo_payment_id: dodoPaymentId,
        amount_usd: amountUsd,
        notes: notes,
      }, { onConflict: 'user_id,component_id' })
    if (error) throw error

    return new Response(JSON.stringify({ ok: true, user_id: userId, component_id: componentId }), {
      status: 200, headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message || 'unknown' }), {
      status: 500, headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }
})
