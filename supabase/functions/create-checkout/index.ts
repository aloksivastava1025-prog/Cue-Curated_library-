// ============================================================
// CUE v2.0 — Create Checkout (Production-Hardened)
// ============================================================
// Changes from v1:
//   §4.4  CORS allow-list (not '*')
//   §4.5  Input validation at edge boundary
//   Plan-based checkout (CUE+ Individual / Team), not per-prompt
//   Uses SERVICE_ROLE_KEY for DB, not ANON_KEY
//   Structured logging
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

// §4.4 — CORS allow-list. Update with your actual production domain.
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5175',
  'http://localhost:5180',
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

// Structured logger
function createLogger(requestId: string) {
  const base = { service: 'create-checkout', requestId }
  return {
    info: (msg: string, data?: Record<string, unknown>) =>
      console.log(JSON.stringify({ ...base, level: 'info', msg, ...data })),
    error: (msg: string, data?: Record<string, unknown>) =>
      console.error(JSON.stringify({ ...base, level: 'error', msg, ...data })),
  }
}

serve(async (req) => {
  const requestId = crypto.randomUUID()
  const log = createLogger(requestId)
  const headers = corsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    // ---- §4.5: Validate input ----
    const body = await req.json()
    const { plan_type, billing_cycle = 'lifetime', customerEmail, customerName, userId: bodyUserId } = body

    // Validate plan_type (the only two products we sell)
    const validPlans = new Set(['cue_plus', 'cue_plus_team'])
    if (!plan_type || !validPlans.has(plan_type)) {
      return new Response(JSON.stringify({ error: 'Invalid plan_type. Must be "cue_plus" or "cue_plus_team".' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Validate billing_cycle
    const validCycles = new Set(['annual', 'lifetime'])
    if (!validCycles.has(billing_cycle)) {
      return new Response(JSON.stringify({ error: 'Invalid billing_cycle. Must be "annual" or "lifetime".' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Validate email
    if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(customerEmail).trim())) {
      return new Response(JSON.stringify({ error: 'Valid email is required.' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // ---- Resolve Clerk user_id ----
    // Prefer a body-supplied Clerk user_id (this app doesn't yet bridge
    // Clerk JWTs into Supabase). Spoofing here is not a financial
    // exploit — the payer's real card is charged either way, and the
    // webhook does its own attribution via customer email + customer_id.
    // The worst case is that someone pays $99 to grant Cue+ to a
    // different Clerk account, which is a gift, not an attack.
    let userId: string | null = bodyUserId && typeof bodyUserId === 'string' ? bodyUserId : null
    if (!userId) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        try {
          const token = authHeader.replace('Bearer ', '')
          const payloadB64 = token.split('.')[1]
          const payload = JSON.parse(atob(payloadB64))
          if (payload.sub && !payload.sub.startsWith('anon')) userId = payload.sub
        } catch { /* fall through */ }
      }
    }
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Missing userId' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // ---- Check if user already has this plan ----
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('plan')
      .eq('user_id', userId)
      .maybeSingle()

    if (profile && profile.plan !== 'free') {
      return new Response(JSON.stringify({ error: 'You already have an active plan.' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // ---- Create Dodo checkout session ----
    const dodoApiKey = Deno.env.get('DODO_PAYMENTS_API_KEY')
    
    // Select product ID based on plan_type and billing_cycle
    let productId;
    if (plan_type === 'cue_plus_team') {
      productId = billing_cycle === 'annual' 
        ? Deno.env.get('DODO_PRODUCT_ID_TEAM_ANNUAL') 
        : Deno.env.get('DODO_PRODUCT_ID_TEAM_LIFETIME');
    } else {
      productId = billing_cycle === 'annual' 
        ? Deno.env.get('DODO_PRODUCT_ID_INDIVIDUAL_ANNUAL') 
        : Deno.env.get('DODO_PRODUCT_ID_INDIVIDUAL_LIFETIME');
    }

    if (!dodoApiKey || !productId) {
      log.error('Dodo Payments secrets not configured for this plan/cycle combination', { plan_type, billing_cycle })
      return new Response(JSON.stringify({ error: 'Payment system not configured for this plan.' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const origin = req.headers.get('origin') || 'https://usecue.com'

    const requestBody = {
      customer: {
        email: String(customerEmail).trim(),
        name: String(customerName || 'Cue User').trim().slice(0, 100),
      },
      product_cart: [
        {
          product_id: productId,
          quantity: 1,
        },
      ],
      return_url: `${origin}/#/billing/success`,
      metadata: {
        user_id: userId,
        plan_type: plan_type,
        billing_cycle: billing_cycle,
        email: String(customerEmail).trim(),
      },
    }

    const isLive = Deno.env.get('DODO_ENV') === 'live'
    const baseUrl = isLive ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com'

    const response = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${dodoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errText = await response.text()
      log.error('Dodo API error', { status: response.status, body: errText.slice(0, 500) })
      return new Response(JSON.stringify({ error: 'Payment provider error' }), {
        status: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const sessionData = await response.json()
    const checkoutUrl = sessionData.payment_link || sessionData.checkout_url || sessionData.url

    if (!checkoutUrl) {
      log.error('No checkout URL in Dodo response', { responseKeys: Object.keys(sessionData) })
      return new Response(JSON.stringify({ error: 'No checkout URL returned' }), {
        status: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    log.info('Checkout session created', { userId, plan_type })

    return new Response(JSON.stringify({ url: checkoutUrl }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    log.error('Unhandled error', { error: err.message })
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
