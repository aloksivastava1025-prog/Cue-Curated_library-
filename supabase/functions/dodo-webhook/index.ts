// ============================================================
// CUE v2.0 — Dodo Webhook (Production-Hardened)
// ============================================================
// Changes from v1:
//   §3.1  Idempotency via payment_events table (PK = webhook-id)
//   §4.1  Signature verification via standardwebhooks (Dodo convention)
//   §4.1  Replay protection: reject timestamps >5 minutes old
//   §4.5  Input validation of payload shape
//   §6    Structured JSON logging with request IDs
//   Plan upgrade targets user_profiles (not user_subscriptions/purchases)
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0"

// Structured logger — every log line is JSON with a request ID
// for correlation. Supabase logs dashboard can filter on these.
function createLogger(requestId: string) {
  const base = { service: 'dodo-webhook', requestId }
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

  // ---- §4.1: Extract and validate Standard Webhooks headers ----
  const signature = req.headers.get('webhook-signature')
  const webhookId = req.headers.get('webhook-id')
  const webhookTimestamp = req.headers.get('webhook-timestamp')

  if (!signature || !webhookId || !webhookTimestamp) {
    log.warn('Missing webhook signature headers')
    return new Response(JSON.stringify({ error: 'Missing webhook headers' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ---- §4.1: Replay protection — reject stale webhooks ----
  const timestampAge = Math.abs(Date.now() / 1000 - Number(webhookTimestamp))
  if (timestampAge > 300) {
    log.warn('Stale webhook rejected', { timestampAge, webhookId })
    return new Response(JSON.stringify({ error: 'Webhook timestamp too old' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const payloadString = await req.text()
  const secret = Deno.env.get('DODO_WEBHOOK_SECRET') || ''

  if (!secret) {
    log.error('DODO_WEBHOOK_SECRET not configured')
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ---- §4.1: Verify signature using Standard Webhooks ----
  let event: any
  try {
    const wh = new Webhook(secret)
    event = wh.verify(payloadString, {
      "webhook-id": webhookId,
      "webhook-timestamp": webhookTimestamp,
      "webhook-signature": signature,
    })
  } catch (err: any) {
    log.error('Webhook signature verification failed', { error: err.message })
    return new Response(JSON.stringify({ error: 'Signature verification failed' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  log.info('Webhook verified', { eventType: event.type, webhookId })

  // ---- §4.5: Validate payload shape ----
  if (!event || typeof event.type !== 'string') {
    log.warn('Invalid event shape', { webhookId })
    return new Response(JSON.stringify({ error: 'Invalid event shape' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ---- Set up Supabase with SERVICE ROLE KEY (bypasses RLS) ----
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!supabaseUrl || !supabaseKey) {
    log.error('Supabase credentials not configured')
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // ---- §3.1: Idempotency check via payment_events table ----
  // Insert the event by its webhook-id. If it already exists (PK
  // constraint violation), we've already processed it — short-circuit.
  const userId = event.data?.metadata?.user_id || null

  const { error: insertError } = await supabase
    .from('payment_events')
    .insert({
      id: webhookId,
      event_type: event.type,
      payload: event,
      user_id: userId,
    })

  if (insertError) {
    if (insertError.code === '23505') {
      // Duplicate event — already processed. Return 200 so Dodo
      // stops retrying, but skip all side effects.
      log.info('Duplicate event skipped', { webhookId, eventType: event.type })
      return new Response(JSON.stringify({ received: true, duplicate: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    // Unexpected DB error — log and return 500 so Dodo retries.
    log.error('Failed to record payment event', { error: insertError.message })
    return new Response(JSON.stringify({ error: 'Database error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ---- Process the event (only runs once per webhook-id) ----
  try {
    if (event.type === 'payment.succeeded' || event.type === 'subscription.active' || event.type === 'subscription.renewed') {
      const planType = event.data?.metadata?.plan_type || 'cue_plus' // 'cue_plus' or 'cue_plus_team'
      const billingCycle = event.data?.metadata?.billing_cycle || 'lifetime'
      const email = event.data?.customer?.email || event.data?.metadata?.email || null
      const teamSeats = planType === 'cue_plus_team' ? 5 : 1

      // If annual, set expiry to 1 year + 3 days grace period from now. If lifetime, null.
      const planExpiresAt = billingCycle === 'annual' 
        ? new Date(Date.now() + 368 * 24 * 60 * 60 * 1000).toISOString() 
        : null

      // Dodo customer id — used as the source-of-truth identifier that
      // survives across sign-in/sign-out and pre-signup purchases.
      const dodoCustomerId = event.data?.customer?.customer_id
        || event.data?.customer_id
        || null
      const paymentId = event.data?.payment_id || event.data?.id || null
      const productId = event.data?.product_id
        || event.data?.product_cart?.[0]?.product_id
        || null

      // Attribute the payment to a user. Ordered fallbacks:
      //   1. event.data.metadata.user_id      (best — set by our create-checkout API)
      //   2. event.data.metadata.reference    (also passed via URL params)
      //   3. Lookup user_profiles by email    (Dodo hosted checkout — email always present)
      //   4. Lookup user_profiles by dodo_customer_id (returning customer)
      let resolvedUserId = userId
        || event.data?.metadata?.reference
        || event.data?.reference
        || null

      if (!resolvedUserId && email) {
        const { data: byEmail } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('email', email.toLowerCase())
          .maybeSingle()
        if (byEmail?.user_id) {
          resolvedUserId = byEmail.user_id
          log.info('Resolved user_id via email fallback', { email, userId: resolvedUserId, paymentId, productId })
        }
      }

      if (!resolvedUserId && dodoCustomerId) {
        const { data: byCustomer } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('dodo_customer_id', dodoCustomerId)
          .maybeSingle()
        if (byCustomer?.user_id) {
          resolvedUserId = byCustomer.user_id
          log.info('Resolved user_id via dodo_customer_id', { dodoCustomerId, userId: resolvedUserId, paymentId })
        }
      }

      // §7 self-heal — no existing profile row for this payer. Create
      // one keyed on Dodo customer id (or email hash if none). This
      // guarantees a payment.succeeded event ALWAYS grants entitlement,
      // even for a user who hasn't signed into CUE yet or whose
      // ensureUserProfile call silently failed. When they later sign
      // in with the matching email, ensureUserProfile will merge.
      if (!resolvedUserId && email) {
        // Use dodo customer id as the temporary user_id anchor so the
        // row is uniquely identifiable and self-heal-safe.
        resolvedUserId = dodoCustomerId ? `dodo:${dodoCustomerId}` : `email:${email.toLowerCase()}`
        log.warn('No profile row; self-heal creating one', { email, userId: resolvedUserId, paymentId, productId })
      }

      if (resolvedUserId) {
        // First check if row already exists — we do NOT want to overwrite
        // plan_started_at on a subscription renewal event. Original signup
        // date is analytics/audit gold.
        const { data: existing } = await supabase
          .from('user_profiles')
          .select('plan_started_at')
          .eq('user_id', resolvedUserId)
          .maybeSingle()

        const payload: Record<string, unknown> = {
          user_id: resolvedUserId,
          email: (email || '').toLowerCase(),
          plan: planType,
          plan_source: 'dodo',
          plan_expires_at: planExpiresAt,
          team_owner_id: resolvedUserId,
          team_seats: teamSeats,
          dodo_customer_id: dodoCustomerId,
        }
        // Only set plan_started_at on FIRST-time insert. Renewals should
        // preserve the original date.
        if (!existing?.plan_started_at) {
          payload.plan_started_at = new Date().toISOString()
        }

        const { error: upsertError } = await supabase
          .from('user_profiles')
          .upsert(payload, { onConflict: 'user_id' })

        if (upsertError) {
          log.error('Failed to upgrade user plan', {
            userId,
            planType,
            error: upsertError.message,
          })
          // Return 500 so Dodo retries. The idempotency table will
          // already have this event — on retry, we'll hit the duplicate
          // check and skip. To allow retry, delete the event first.
          await supabase.from('payment_events').delete().eq('id', webhookId)
          return new Response(JSON.stringify({ error: 'Plan upgrade failed' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        log.info('User plan upgraded', { userId, planType, teamSeats })

        // TODO: Trigger welcome/receipt email via Resend here.
        // This is where the Resend integration plugs in. The
        // idempotency table ensures we never send duplicate emails
        // on webhook retries.
      } else {
        log.warn('payment.succeeded but no user_id in metadata', { webhookId })
      }
    }

    // Handle refunds / cancellations / failed payments
    if (
      event.type === 'refund.succeeded' || 
      event.type === 'subscription.canceled' || 
      event.type === 'subscription.cancelled' || 
      event.type === 'subscription.failed' || 
      event.type === 'subscription.on_hold'
    ) {
      if (userId) {
        const { error: downgradeError } = await supabase
          .from('user_profiles')
          .update({
            plan: 'free',
            plan_source: 'dodo_refund',
          })
          .eq('user_id', userId)

        if (downgradeError) {
          log.error('Failed to downgrade user on refund', {
            userId,
            error: downgradeError.message,
          })
        } else {
          log.info('User downgraded on refund', { userId })
        }
      }
    }
  } catch (err: any) {
    log.error('Event processing failed', {
      webhookId,
      eventType: event.type,
      error: err.message,
    })
    // Delete the idempotency record so the retry can re-process.
    await supabase.from('payment_events').delete().eq('id', webhookId)
    return new Response(JSON.stringify({ error: 'Processing failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  log.info('Event processed successfully', { webhookId, eventType: event.type })
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
