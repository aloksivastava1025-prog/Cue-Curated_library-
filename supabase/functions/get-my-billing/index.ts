// ============================================================
// CUE — Fetch billing summary for the signed-in user
// ============================================================
// Returns plan, plan_started_at, dodo_customer_id, and the last
// payment_id (for invoice download). Reads user_profiles + the
// payment_events history via service_role so RLS never gets in the
// way of the buyer seeing their own receipt.
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

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  // AUTH: pre-launch audit — trusting body.userId let any signed-in
  // attacker fetch anyone else's billing details (plan expiry, Dodo
  // customer id, next billing date, subscription id). Now we verify
  // the caller's Clerk JWT and use the verified sub.
  let verifiedSub = ''
  let verifiedEmail = ''
  try {
    const claims = await verifyClerkJwt(req)
    verifiedSub = claims.sub
    verifiedEmail = (claims.email || '').toLowerCase()
  } catch (err) {
    return authErrorResponse(err, headers)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const bodyUserId: string | null = body?.userId || null

    if (bodyUserId && bodyUserId !== verifiedSub) {
      return new Response(JSON.stringify({ error: 'userId does not match token' }), {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }
    const userId = verifiedSub
    const email: string | null = verifiedEmail || null

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // Profile row — user_id first, email fallback for self-healed rows.
    let { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if ((!profile || profile.plan === 'free') && email) {
      const { data: byEmail } = await supabase
        .from('user_profiles')
        .select('*')
        .ilike('email', email)
        .order('plan_started_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      if (byEmail && byEmail.plan !== 'free') profile = byEmail
    }

    // Latest payment.succeeded row — matched by dodo_customer_id first,
    // else email. Used for the invoice download button.
    let payments: any[] = []
    if (profile?.dodo_customer_id) {
      const { data } = await supabase
        .from('payment_events')
        .select('id, event_type, payload, processed_at')
        .in('event_type', ['payment.succeeded'])
        .contains('payload', { data: { customer: { customer_id: profile.dodo_customer_id } } })
        .order('processed_at', { ascending: false })
        .limit(5)
      payments = data || []
    }
    if (!payments.length && (profile?.email || email)) {
      const emailKey = (profile?.email || email || '').toLowerCase()
      const { data } = await supabase
        .from('payment_events')
        .select('id, event_type, payload, processed_at')
        .in('event_type', ['payment.succeeded'])
        .contains('payload', { data: { customer: { email: emailKey } } })
        .order('processed_at', { ascending: false })
        .limit(5)
      payments = data || []
    }

    const history = (payments || []).map((row) => {
      const d = row.payload?.data || {}
      return {
        payment_id: d.payment_id || d.id || null,
        amount:     d.total_amount ?? d.amount ?? null,
        currency:   d.currency || d.settlement_currency || null,
        at:         row.processed_at,
      }
    }).filter((r) => r.payment_id)

    // Return only fields the caller could already know or derive from
    // Clerk. We intentionally drop `email` and `full_name` — the
    // client already has them from useUser(); echoing them from the
    // server would be an extra PII surface for a spoofed userId.
    return new Response(JSON.stringify({
      plan:                    profile?.plan || 'free',
      plan_source:             profile?.plan_source || null,
      plan_started_at:         profile?.plan_started_at || null,
      plan_expires_at:         profile?.plan_expires_at || null,
      dodo_customer_id:        profile?.dodo_customer_id || null,
      subscription_id:         profile?.dodo_subscription_id || null,
      next_billing_date:       profile?.next_billing_date || null,
      auto_renew:              profile?.auto_renew ?? null,
      failed_renewal_count:    profile?.failed_renewal_count ?? 0,
      last_payment_id:         history[0]?.payment_id || null,
      history,
    }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
