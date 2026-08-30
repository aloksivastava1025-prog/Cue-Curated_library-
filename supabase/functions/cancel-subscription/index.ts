// ============================================================
// CUE — Cancel Monthly Subscription (cancel-at-period-end)
// ============================================================
// Called from the Billing page's "Cancel subscription" button.
// Policy: cancel-at-period-end. The subscription stops renewing at
// the next billing cycle boundary; the user's Cue+ access stays
// active until then. This mirrors industry norm (Substack, Notion,
// Superhuman) and reduces user regret — the failed-cancel-then-
// refund churn is worse than one extra billed period.
//
// Flow:
//   1. Authenticate the caller via bodyUserId (Clerk user_id).
//   2. Look up user_profiles.dodo_subscription_id for that user.
//   3. Call Dodo PATCH /subscriptions/:id with
//        { cancel_at_next_billing_date: true }.
//   4. Mark user_profiles.plan_source = 'monthly:cancelling' so the
//      Billing page can show "Access ends on DATE" until the webhook
//      fires subscription.canceled at cycle end.
//   5. Return { ok, cancels_at }.
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

function createLogger(requestId: string) {
  const base = { service: 'cancel-subscription', requestId }
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

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  // AUTH: pre-launch audit found this trusted body.userId — attackers
  // could cancel any Cue+ user's subscription by guessing/enumerating
  // Clerk user ids. Now we verify the caller's Clerk JWT and use the
  // verified `sub` — the body id (if present) must match.
  let verifiedSub = ''
  try {
    const claims = await verifyClerkJwt(req)
    verifiedSub = claims.sub
  } catch (err) {
    return authErrorResponse(err, headers)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const bodyUserId: string | undefined = body?.userId

    if (bodyUserId && bodyUserId !== verifiedSub) {
      return new Response(JSON.stringify({ error: 'userId does not match token' }), {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }
    const userId = verifiedSub

    const supabaseUrl = Deno.env.get('SUPABASE_URL') || ''
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    if (!supabaseUrl || !serviceRole) {
      log.error('Supabase env missing')
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }
    const supabase = createClient(supabaseUrl, serviceRole)

    // Look up subscription id. This column was added in the
    // renewal-tracking migration; if it's null the user has no
    // cancellable subscription (e.g. they're on lifetime).
    const { data: profile, error: profErr } = await supabase
      .from('user_profiles')
      .select('user_id, plan, plan_source, dodo_subscription_id')
      .eq('user_id', userId)
      .maybeSingle()

    if (profErr) {
      log.error('Profile lookup failed', { error: profErr.message })
      return new Response(JSON.stringify({ error: 'Lookup failed' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }
    if (!profile) {
      return new Response(JSON.stringify({ error: 'No Cue+ subscription found for this account' }), {
        status: 404,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    if (!profile.dodo_subscription_id) {
      // Lifetime plan or a legacy checkout that stored payment_id
      // instead of subscription_id. Either way, nothing to cancel.
      return new Response(JSON.stringify({
        error: 'This account is on a one-time plan and has nothing to cancel.',
      }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Already flagged as cancelling — return current state, don't
    // call Dodo again.
    if (profile.plan_source === 'monthly:cancelling') {
      return new Response(JSON.stringify({
        ok: true,
        already_cancelled: true,
        message: 'Cancellation already scheduled — access continues until the end of your billing cycle.',
      }), {
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Dodo cancel: PATCH /subscriptions/:id with
    //   { cancel_at_next_billing_date: true }
    const dodoApiKey = (Deno.env.get('DODO_PAYMENTS_API_KEY') || '').trim()
    if (!dodoApiKey) {
      log.error('Dodo API key missing')
      return new Response(JSON.stringify({ error: 'Payment provider not configured' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }
    const isLive = Deno.env.get('DODO_ENV') === 'live'
    const baseUrl = isLive ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com'
    const dodoUrl = `${baseUrl}/subscriptions/${profile.dodo_subscription_id}`

    const dodoResp = await fetch(dodoUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${dodoApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ cancel_at_next_billing_date: true }),
    })

    if (!dodoResp.ok) {
      const errText = await dodoResp.text()
      log.error('Dodo cancel failed', { status: dodoResp.status, body: errText.slice(0, 500) })
      return new Response(JSON.stringify({
        error: 'Payment provider rejected the cancellation. Please try again or email hello@cuedesign.space.',
        dodo_status: dodoResp.status,
      }), {
        status: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const dodoData = await dodoResp.json().catch(() => ({}))
    const cancelsAt = dodoData?.next_billing_date || dodoData?.current_period_end || null

    // Flag the profile so the Billing page can show the pending-
    // cancel state. The eventual subscription.canceled webhook will
    // move plan back to 'free' at cycle end.
    await supabase
      .from('user_profiles')
      .update({
        plan_source: 'monthly:cancelling',
        plan_expires_at: cancelsAt || profile.plan_expires_at || null,
      })
      .eq('user_id', userId)

    log.info('Subscription cancelled at period end', { userId, cancelsAt })

    return new Response(JSON.stringify({
      ok: true,
      cancels_at: cancelsAt,
      message: 'Cancellation scheduled. Access remains active until the end of your current billing cycle.',
    }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    log.error('Unhandled error', { error: err.message })
    return new Response(JSON.stringify({ error: err.message || 'Cancel failed' }), {
      status: 400,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
