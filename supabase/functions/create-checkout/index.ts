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

// Structured logger
function createLogger(requestId: string) {
  const base = { service: 'create-checkout', requestId }
  return {
    info: (msg: string, data?: Record<string, unknown>) =>
      console.log(JSON.stringify({ ...base, level: 'info', msg, ...data })),
    warn: (msg: string, data?: Record<string, unknown>) =>
      console.warn(JSON.stringify({ ...base, level: 'warn', msg, ...data })),
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
    const { plan_type, billing_cycle = 'lifetime', customerEmail, customerName, userId: bodyUserId, couponCode } = body

    // Whitelist of discount codes we honour server-side. Client can ask
    // for one but only a code in this set is forwarded to Dodo — anything
    // else is silently dropped so a spoofed body can't slip in a code we
    // didn't authorise. Dodo enforces the actual expiry / redemption cap.
    const ALLOWED_COUPONS = new Set(['CUE49'])
    const normalizedCoupon = typeof couponCode === 'string'
      ? couponCode.trim().toUpperCase()
      : ''
    const discountCode = ALLOWED_COUPONS.has(normalizedCoupon) ? normalizedCoupon : null

    // Validate plan_type (the only two products we sell)
    const validPlans = new Set(['cue_plus', 'cue_plus_team'])
    if (!plan_type || !validPlans.has(plan_type)) {
      return new Response(JSON.stringify({ error: 'Invalid plan_type. Must be "cue_plus" or "cue_plus_team".' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Validate billing_cycle
    const validCycles = new Set(['monthly', 'annual', 'lifetime'])
    if (!validCycles.has(billing_cycle)) {
      return new Response(JSON.stringify({ error: 'Invalid billing_cycle. Must be "monthly", "annual" or "lifetime".' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }
    // Monthly currently only ships for the individual Cue+ plan.
    // If Team monthly is added later, drop this guard.
    if (billing_cycle === 'monthly' && plan_type !== 'cue_plus') {
      return new Response(JSON.stringify({ error: 'Monthly is only available on the individual Cue+ plan.' }), {
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

    // ---- Founding-cap enforcement (server-side source of truth) ----
    // Client display shows "N of 50" but a stale tab or scripted client
    // could sneak a 51st through. Only enforce for the founding lifetime
    // product (individual lifetime). Team + annual plans have no cap.
    if (plan_type === 'cue_plus' && billing_cycle === 'lifetime') {
      const FOUNDING_CAP = 50
      // aloksivastava1025@gmail.com intentionally excluded — see
      // getFoundingCount in src/lib/backend.js for the rationale.
      const ADMIN_EMAILS = new Set([
        'aloks.int@teachforindia.org',
        'akashkumar7653099@gmail.com',
        'srivastavaalok2214@gmail.com',
      ])
      const { data: paidRows } = await supabase
        .from('user_profiles')
        .select('email, plan_source')
        .eq('plan', 'cue_plus')
      const realCount = (paidRows || []).filter((r) => {
        const em = (r.email || '').toLowerCase()
        if (ADMIN_EMAILS.has(em)) return false
        if (r.plan_source === 'reconciliation') return false
        if (r.plan_source === 'manual_link_dodo_email_mismatch') return false
        return true
      }).length
      if (realCount >= FOUNDING_CAP) {
        log.warn('Founding cap reached — blocking checkout', { realCount, userId })
        return new Response(JSON.stringify({
          error: 'Founding 50 spots are all claimed — launch pricing is live now. Refresh the page for the current price.',
        }), {
          status: 409,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }
    }

    // ---- Rate limit: 5 checkout attempts per user per 60s ----
    // Uses the existing rate_limit_windows table (upsert-then-increment
    // pattern). Cheap and race-tolerant enough for a $99 one-time
    // product; prevents rapid-click / abuse and Dodo-side lockouts.
    try {
      const rlKey = `checkout:${userId}`
      const nowMs = Date.now()
      const { data: window } = await supabase
        .from('rate_limit_windows')
        .select('count, reset_at')
        .eq('key', rlKey)
        .maybeSingle()
      if (window && new Date(window.reset_at).getTime() > nowMs && window.count >= 5) {
        return new Response(JSON.stringify({ error: 'Too many checkout attempts. Please wait a minute.' }), {
          status: 429,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }
      const nextReset = window && new Date(window.reset_at).getTime() > nowMs
        ? window.reset_at
        : new Date(nowMs + 60_000).toISOString()
      const nextCount = window && new Date(window.reset_at).getTime() > nowMs
        ? window.count + 1
        : 1
      await supabase
        .from('rate_limit_windows')
        .upsert({ key: rlKey, count: nextCount, reset_at: nextReset }, { onConflict: 'key' })
    } catch (rlErr: any) {
      // Rate-limit table absent or unwritable — log and continue rather
      // than block legitimate checkout.
      log.warn('Rate limit check failed', { error: rlErr?.message })
    }

    // ---- Create Dodo checkout session ----
    const dodoApiKey = (Deno.env.get('DODO_PAYMENTS_API_KEY') || '').trim()
    
    // Select product ID based on plan_type and billing_cycle.
    // Individual monthly is the new billing cycle; team monthly is
    // not shipped yet and is blocked earlier in this function.
    let productId;
    if (plan_type === 'cue_plus_team') {
      productId = billing_cycle === 'annual'
        ? Deno.env.get('DODO_PRODUCT_ID_TEAM_ANNUAL')
        : Deno.env.get('DODO_PRODUCT_ID_TEAM_LIFETIME');
    } else {
      if (billing_cycle === 'monthly') {
        productId = Deno.env.get('DODO_PRODUCT_ID_INDIVIDUAL_MONTHLY');
      } else if (billing_cycle === 'annual') {
        productId = Deno.env.get('DODO_PRODUCT_ID_INDIVIDUAL_ANNUAL');
      } else {
        productId = Deno.env.get('DODO_PRODUCT_ID_INDIVIDUAL_LIFETIME');
      }
    }
    // Env vars often pick up stray whitespace from dashboard paste.
    productId = productId ? productId.trim() : productId;

    if (!dodoApiKey || !productId) {
      log.error('Dodo Payments secrets not configured for this plan/cycle combination', { plan_type, billing_cycle })
      return new Response(JSON.stringify({ error: 'Payment system not configured for this plan.' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const origin = req.headers.get('origin') || 'https://cuedesign.space'

    // Determine the buyer's country so Dodo's Localized Pricing By
    // Country picks the right currency. Priority:
    //   1. body.buyerCountry — detected on the client via Cloudflare
    //      trace (the reliable path, since Supabase edge functions
    //      run on Deno Deploy — no cf-ipcountry header here)
    //   2. cf-ipcountry / vercel headers (in case the fn is fronted
    //      by Cloudflare in future)
    //   3. Fall back to 'IN' (safe default for India-heavy launch)
    const rawCountry = String(
      body?.buyerCountry ||
      req.headers.get('cf-ipcountry') ||
      req.headers.get('x-vercel-ip-country') ||
      req.headers.get('x-country') ||
      'IN'
    ).toUpperCase()
    const buyerCountry = /^[A-Z]{2}$/.test(rawCountry) ? rawCountry : 'IN'

    // Dodo splits its checkout API by product type:
    //   • /payments        — one-time products (annual + lifetime here)
    //   • /subscriptions   — recurring products (monthly here)
    // The bodies differ: /payments takes product_cart[], /subscriptions
    // takes product_id + quantity at the root. Everything else — customer,
    // billing, metadata, return_url — is identical.
    const isSubscription = billing_cycle === 'monthly'
    const commonFields = {
      payment_link: true,
      customer: {
        email: String(customerEmail).trim(),
        name: String(customerName || 'Cue User').trim().slice(0, 100),
      },
      billing: {
        country: buyerCountry,
        state:   'NA',
        city:    'NA',
        street:  'NA',
        zipcode: '000000',
      },
      // Dodo hides the "Have a discount code?" input on the hosted
      // checkout unless this flag is on. Off by default in the API
      // even when discount codes exist on the account — we need it
      // so a user who found CUE49 through a hint can actually enter
      // it at checkout.
      feature_flags: {
        allow_discount_code: true,
      },
      return_url: `${origin}/#/billing/success`,
      metadata: {
        user_id: userId,
        plan_type: plan_type,
        billing_cycle: billing_cycle,
        email: String(customerEmail).trim(),
      },
    }
    const requestBody = isSubscription
      ? { ...commonFields, product_id: productId, quantity: 1, ...(discountCode ? { discount_code: discountCode } : {}) }
      : { ...commonFields, product_cart: [{ product_id: productId, quantity: 1 }], ...(discountCode ? { discount_code: discountCode } : {}) }

    const isLive = Deno.env.get('DODO_ENV') === 'live'
    const baseUrl = isLive ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com'
    const endpointPath = isSubscription ? '/subscriptions' : '/payments'

    const response = await fetch(`${baseUrl}${endpointPath}`, {
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
      return new Response(JSON.stringify({
        error: 'Payment provider error',
        dodo_status: response.status,
        dodo_body: errText.slice(0, 500),
      }), {
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

    log.info('Checkout session created', { userId, plan_type, buyerCountry })

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
