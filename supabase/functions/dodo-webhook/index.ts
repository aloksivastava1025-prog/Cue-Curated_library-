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
    // ------------------------------------------------------------
    // Single-component grant path — fires BEFORE the Cue+ upgrade
    // branch. Any payment that arrived via the "Request this
    // component — $20" checkout carries component_id in metadata /
    // custom_data / reference, OR uses the dedicated product id
    // configured in DODO_SINGLE_COMPONENT_PRODUCT_ID. Route those to
    // user_component_grants instead of upgrading the buyer's plan
    // to Cue+ (which would defeat the whole point of the flow).
    // ------------------------------------------------------------
    const singleComponentProductId =
      Deno.env.get('DODO_SINGLE_COMPONENT_PRODUCT_ID') || ''
    const _productId0 = event.data?.product_id
      || event.data?.product_cart?.[0]?.product_id
      || null
    const componentIdFromEvent =
         event.data?.metadata?.component_id
      || event.data?.custom_data?.component_id
      || null
    const looksLikeSingleComponent =
      event.type === 'payment.succeeded' &&
      (
        Boolean(componentIdFromEvent) ||
        (singleComponentProductId && _productId0 === singleComponentProductId)
      )

    if (looksLikeSingleComponent) {
      // Whitelist the shape of component ids we accept ("cue001",
      // "cue142" etc). Anything else is dropped so a malformed /
      // hostile URL param never lands in the grants table.
      const componentId = /^cue\d{1,4}$/i.test(String(componentIdFromEvent || ''))
        ? String(componentIdFromEvent).toLowerCase()
        : null
      const email = event.data?.customer?.email || event.data?.metadata?.email || null
      const paymentId = event.data?.payment_id || event.data?.id || null
      const amountUsd = (() => {
        const raw = event.data?.total_amount ?? event.data?.amount ?? null
        if (raw == null) return null
        // Dodo amounts arrive in cents; guard against decimals just in case.
        return typeof raw === 'number' ? raw / 100 : Number(raw) / 100
      })()

      // Resolve user_id — same waterfall as the Cue+ path so we
      // never lose a payment to attribution failure.
      const dodoCustomerId =
        event.data?.customer?.customer_id || event.data?.customer_id || null
      let resolvedUserId =
           userId
        || event.data?.metadata?.user_id
        || event.data?.metadata?.reference
        || event.data?.reference
        || null

      if (!resolvedUserId && email) {
        const { data: byEmail } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('email', email.toLowerCase())
          .maybeSingle()
        if (byEmail?.user_id) resolvedUserId = byEmail.user_id
      }
      if (!resolvedUserId && dodoCustomerId) {
        const { data: byCustomer } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('dodo_customer_id', dodoCustomerId)
          .maybeSingle()
        if (byCustomer?.user_id) resolvedUserId = byCustomer.user_id
      }
      if (!resolvedUserId && email) {
        // Self-heal anchor so a payment from a not-yet-signed-in
        // buyer isn't dropped. ensureUserProfile will merge later.
        resolvedUserId = dodoCustomerId
          ? `dodo:${dodoCustomerId}`
          : `email:${email.toLowerCase()}`
      }

      if (!resolvedUserId || !componentId) {
        // Missing either identity or which component — the payment
        // is real but we can't grant automatically. Log loud so
        // Alok sees it and grants via the admin safety-net UI.
        log.error('Single-component payment could not be auto-granted', {
          paymentId, email, componentId, resolvedUserId,
        })
        return new Response(JSON.stringify({
          ok: true,
          warning: 'payment recorded, grant deferred — see admin panel',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      const { error: grantErr } = await supabase
        .from('user_component_grants')
        .upsert({
          user_id: resolvedUserId,
          component_id: componentId,
          granted_via: 'dodo',
          dodo_payment_id: paymentId,
          amount_usd: amountUsd,
          notes: email ? `Auto-grant on Dodo payment. Buyer email: ${email}` : null,
        }, { onConflict: 'user_id,component_id' })

      if (grantErr) {
        log.error('Failed to insert component grant', {
          error: grantErr.message, paymentId, componentId, resolvedUserId,
        })
        // Roll back idempotency lock so a retry can replay the event.
        await supabase.from('payment_events').delete().eq('id', webhookId)
        return new Response(JSON.stringify({ error: 'grant insert failed' }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        })
      }

      log.info('Single-component access granted', {
        paymentId, componentId, userId: resolvedUserId, amountUsd,
      })
      return new Response(JSON.stringify({
        ok: true, granted: { user_id: resolvedUserId, component_id: componentId },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } })
    }

    if (event.type === 'payment.succeeded' || event.type === 'subscription.active' || event.type === 'subscription.renewed') {
      const planType = event.data?.metadata?.plan_type || 'cue_plus' // 'cue_plus' or 'cue_plus_team'
      const billingCycle = event.data?.metadata?.billing_cycle || 'lifetime'
      const email = event.data?.customer?.email || event.data?.metadata?.email || null
      const teamSeats = planType === 'cue_plus_team' ? 5 : 1

      // Plan expiry per billing cycle:
      //   monthly  → 35 days out (30 + 5 grace), or Dodo's next_billing_date
      //   annual   → 368 days out (365 + 3 grace)
      //   lifetime → null (never expires)
      // For monthly we prefer Dodo's own next_billing_date because it
      // accounts for anniversary dates the webhook doesn't have to
      // recompute (e.g. billed on the 30th of every month).
      const dodoNextBilling = event.data?.next_billing_date
        || event.data?.subscription?.next_billing_date
        || event.data?.current_period_end
        || null
      let planExpiresAt: string | null = null
      if (billingCycle === 'annual') {
        planExpiresAt = new Date(Date.now() + 368 * 24 * 60 * 60 * 1000).toISOString()
      } else if (billingCycle === 'monthly') {
        planExpiresAt = dodoNextBilling
          ? new Date(new Date(dodoNextBilling).getTime() + 5 * 24 * 60 * 60 * 1000).toISOString()
          : new Date(Date.now() + 35 * 24 * 60 * 60 * 1000).toISOString()
      }

      // Dodo subscription id — set for monthly, null for lifetime/annual
      // one-time products. Persisted so the Cancel button can PATCH the
      // correct subscription resource.
      const dodoSubscriptionId = event.data?.subscription_id
        || event.data?.subscription?.subscription_id
        || event.data?.subscription?.id
        || null

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
        // Monthly-only fields — populated for subscriptions, left
        // untouched for one-time payments so lifetime rows aren't
        // polluted with subscription state.
        if (billingCycle === 'monthly') {
          payload.dodo_subscription_id = dodoSubscriptionId
          payload.next_billing_date = dodoNextBilling
          payload.auto_renew = true
          payload.failed_renewal_count = 0
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

        // Welcome email — fire-and-forget via Resend. Idempotency
        // is guaranteed by the payment_events PK check above, so
        // this branch only runs once per webhook-id. On failure we
        // log but never fail the webhook (email is a nice-to-have,
        // access is already granted).
        if (email && event.type === 'payment.succeeded') {
          try {
            const resendKey = Deno.env.get('RESEND_API_KEY')
            if (resendKey) {
              const displayName = event.data?.customer?.name
                || (email ? email.split('@')[0] : 'there')
              const currency = String(event.data?.currency || 'USD').toUpperCase()
              const totalMinor = event.data?.total_amount ?? event.data?.amount ?? null
              const totalFmt = totalMinor != null
                ? `${(totalMinor / 100).toFixed(2)} ${currency}`
                : ''
              const invoiceLink = paymentId
                ? `https://rkinvrdjbmoozjzmqshn.supabase.co/functions/v1/get-invoice?payment_id=${paymentId}`
                : null
              const esc = (s: string = '') => String(s).replace(/[&<>"']/g, (c) => (
                { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
              ))
              const html = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0A0A0A;">
                  <div style="font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #0000FF; font-weight: 700; margin-bottom: 12px;">Cue+ · Founding</div>
                  <h2 style="margin: 0 0 12px; font-family: Georgia, serif; font-style: italic; font-weight: 400; font-size: 32px; color: #0A0A0A; line-height: 1.15;">
                    Welcome to Cue+, ${esc(displayName)}.
                  </h2>
                  <p style="font-size: 15px; line-height: 1.7; color: #333; margin: 0 0 20px;">
                    Your founding spot is locked ${totalFmt ? `at <strong>${esc(totalFmt)}</strong>` : ''}, forever. Full library unlocked, every future drop included, no renewals.
                  </p>
                  <div style="margin: 24px 0;">
                    <a href="https://www.cuedesign.space" style="display: inline-block; padding: 12px 24px; background: #0000FF; color: #fff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">Start exploring →</a>
                  </div>
                  ${invoiceLink ? `<p style="font-size: 13px; color: #666; margin: 20px 0 6px;">Your invoice: <a href="${invoiceLink}" style="color: #0000FF;">Download PDF</a></p>` : ''}
                  <div style="margin: 32px 0 0; padding-top: 20px; border-top: 1px solid #e5e5e5;">
                    <p style="font-size: 13.5px; line-height: 1.7; color: #333; margin: 0 0 10px;">
                      One-person shop here — replies from <a href="mailto:hello@cuedesign.space" style="color: #0000FF;">hello@cuedesign.space</a> come from me personally.
                    </p>
                    <p style="font-size: 13.5px; line-height: 1.7; color: #333; margin: 0;">
                      Founding members shape what gets built next. If a specific component's code would unblock you, email me — I ship it personally.
                    </p>
                    <p style="margin: 20px 0 4px; font-size: 13px; color: #333;">— Alok, Cue</p>
                    <p style="margin: 0; font-size: 11.5px; color: #999;">
                      <a href="https://www.cuedesign.space" style="color: #999; text-decoration: none;">cuedesign.space</a> · <a href="https://www.cuedesign.space/#/billing" style="color: #999; text-decoration: none;">Billing & invoices</a>
                    </p>
                  </div>
                </div>
              `
              const resp = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${resendKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: 'Alok — Cue <hello@cuedesign.space>',
                  to: email,
                  reply_to: 'hello@cuedesign.space',
                  subject: `Welcome to Cue+ · your founding spot is locked`,
                  html,
                }),
              })
              if (resp.ok) {
                log.info('Welcome email sent', { email, paymentId })
              } else {
                const errText = await resp.text()
                log.warn('Welcome email failed', {
                  email, paymentId,
                  status: resp.status,
                  body: errText.slice(0, 300),
                })
              }
            } else {
              log.warn('RESEND_API_KEY not set — skipping welcome email')
            }
          } catch (e: any) {
            // Never fail the webhook because of email issues — plan
            // is already upgraded, welcome mail is a nice-to-have.
            log.warn('Welcome email threw', { error: e?.message })
          }
        }

        // ---- Founder alert email — every real Cue+ purchase pings Alok ----
        // Separate try/catch so a founder-notification hiccup never blocks
        // the customer's welcome path or the webhook 200.
        if (email && event.type === 'payment.succeeded') {
          try {
            const resendKey = Deno.env.get('RESEND_API_KEY')
            const founderInbox = (Deno.env.get('FOUNDER_EMAIL') || 'aloksivastava1025@gmail.com').trim()
            if (resendKey) {
              // Live founding count for context — same filter as the UI.
              const ADMIN_EMAILS = new Set([
                'aloks.int@teachforindia.org',
                'akashkumar7653099@gmail.com',
                'srivastavaalok2214@gmail.com',
              ])
              const { data: paidRows } = await supabase
                .from('user_profiles')
                .select('email, plan_source')
                .eq('plan', 'cue_plus')
              const foundingCount = (paidRows || []).filter((r: any) => {
                const em = (r.email || '').toLowerCase()
                if (ADMIN_EMAILS.has(em)) return false
                if (r.plan_source === 'reconciliation') return false
                if (r.plan_source === 'manual_link_dodo_email_mismatch') return false
                return true
              }).length

              const displayName = event.data?.customer?.name || (email ? email.split('@')[0] : 'Someone')
              const currency = String(event.data?.currency || 'USD').toUpperCase()
              const totalMinor = event.data?.total_amount ?? event.data?.amount ?? null
              const totalFmt = totalMinor != null ? `${(totalMinor / 100).toFixed(2)} ${currency}` : ''
              const buyerCountry = event.data?.billing?.country || event.data?.customer?.country || 'IN'
              const escF = (s: string = '') => String(s).replace(/[&<>"']/g, (c) => (
                { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
              ))
              const founderHtml = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0A0A0A;">
                  <div style="font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #0000FF; font-weight: 700; margin-bottom: 12px;">Cue · New sale 🎉</div>
                  <h2 style="margin: 0 0 14px; font-family: Georgia, serif; font-style: italic; font-weight: 400; font-size: 28px; color: #0A0A0A; line-height: 1.15;">
                    Founding #${foundingCount} — ${escF(displayName)}
                  </h2>
                  <table style="border-collapse: collapse; font-size: 14px; margin-bottom: 16px; width: 100%;">
                    <tr><td style="padding: 4px 12px 4px 0; color: #666; width: 100px;">Email</td><td style="padding: 4px 0;"><a href="mailto:${escF(email)}" style="color: #0000FF;">${escF(email)}</a></td></tr>
                    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Amount</td><td style="padding: 4px 0; font-weight: 600;">${escF(totalFmt)}</td></tr>
                    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Plan</td><td style="padding: 4px 0;">${escF(planType)} · ${escF(billingCycle)}</td></tr>
                    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Country</td><td style="padding: 4px 0;">${escF(buyerCountry)}</td></tr>
                    <tr><td style="padding: 4px 12px 4px 0; color: #666;">Seats left</td><td style="padding: 4px 0;">${Math.max(50 - foundingCount, 0)} of 50 remaining</td></tr>
                    ${paymentId ? `<tr><td style="padding: 4px 12px 4px 0; color: #666;">Payment ID</td><td style="padding: 4px 0; font-family: Menlo, monospace; font-size: 12px;">${escF(paymentId)}</td></tr>` : ''}
                  </table>
                  <div style="margin: 20px 0;">
                    <a href="https://www.cuedesign.space/#/admin/subscriptions" style="display: inline-block; padding: 10px 20px; background: #0000FF; color: #fff; text-decoration: none; border-radius: 6px; font-size: 13px; font-weight: 600;">Open Subscriptions →</a>
                  </div>
                  <p style="margin: 20px 0 4px; font-size: 12px; color: #999;">Auto-generated from dodo-webhook · reply not monitored</p>
                </div>
              `
              const alertResp = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${resendKey}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  from: 'Cue Sales <hello@cuedesign.space>',
                  to: founderInbox,
                  reply_to: email,
                  subject: `🎉 New Cue+ sale — ${displayName} (#${foundingCount}/50)`,
                  html: founderHtml,
                }),
              })
              if (alertResp.ok) {
                log.info('Founder alert sent', { founderInbox, foundingCount })
              } else {
                const errText = await alertResp.text()
                log.warn('Founder alert failed', {
                  founderInbox,
                  status: alertResp.status,
                  body: errText.slice(0, 300),
                })
              }
            }
          } catch (e: any) {
            log.warn('Founder alert threw', { error: e?.message })
          }
        }
      } else {
        log.warn('payment.succeeded but no user_id in metadata', { webhookId })
      }
    }

    // Handle a failed renewal charge WITHOUT revoking access — Dodo
    // typically retries the card 2-3 times before giving up and firing
    // subscription.canceled. Here we bump the failure counter, keep
    // access active (grace period), and alert the founder. The eventual
    // subscription.canceled event (below) is what actually downgrades
    // the user.
    if (
      event.type === 'payment.failed' ||
      event.type === 'subscription.renewal_failed' ||
      event.type === 'subscription.past_due'
    ) {
      const failEmail = event.data?.customer?.email
        || event.data?.metadata?.email
        || null
      const failCustomerId = event.data?.customer?.customer_id
        || event.data?.customer_id
        || null
      let failUserId = event.data?.metadata?.user_id
        || event.data?.metadata?.reference
        || event.data?.reference
        || null
      if (!failUserId && failEmail) {
        const { data: byEmail } = await supabase
          .from('user_profiles')
          .select('user_id, failed_renewal_count')
          .ilike('email', failEmail)
          .maybeSingle()
        if (byEmail?.user_id) failUserId = byEmail.user_id
      }
      if (!failUserId && failCustomerId) {
        const { data: byCustomer } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('dodo_customer_id', failCustomerId)
          .maybeSingle()
        if (byCustomer?.user_id) failUserId = byCustomer.user_id
      }

      if (failUserId) {
        // Fetch current counter atomically-ish (read, +1, write).
        const { data: currentRow } = await supabase
          .from('user_profiles')
          .select('failed_renewal_count')
          .eq('user_id', failUserId)
          .maybeSingle()
        const nextCount = ((currentRow?.failed_renewal_count as number) || 0) + 1
        await supabase
          .from('user_profiles')
          .update({ failed_renewal_count: nextCount })
          .eq('user_id', failUserId)

        // Founder alert on every failure — small volume today, so
        // noise cost is negligible and each failure is worth investigating.
        try {
          const resendKey = Deno.env.get('RESEND_API_KEY')
          const founderEmail = Deno.env.get('FOUNDER_EMAIL')
          if (resendKey && founderEmail) {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${resendKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Cue Alerts <alerts@cuedesign.space>',
                to: founderEmail,
                subject: `⚠️ Renewal failed (attempt ${nextCount}) — ${failEmail || failUserId}`,
                html: `<p>Dodo reported a failed renewal for <strong>${failEmail || failUserId}</strong>.</p><p>Consecutive failures: <strong>${nextCount}</strong>. Access remains active until subscription.canceled fires. Consider reaching out.</p>`,
              }),
            })
          }
        } catch (e: any) {
          log.warn('Founder failure-alert threw', { error: e?.message })
        }

        log.info('Renewal failure recorded', { userId: failUserId, failureCount: nextCount, eventType: event.type })
      } else {
        log.warn('Renewal-failure event with no attributable user', { webhookId, eventType: event.type })
      }

      return new Response(JSON.stringify({ ok: true, event: event.type }), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Handle refunds / cancellations / failed payments.
    // Use the same 4-step attribution chain as payment.succeeded so a
    // refund revokes access whether the original row was matched by
    // metadata.user_id, email, or dodo_customer_id (self-heal).
    if (
      event.type === 'refund.succeeded' ||
      event.type === 'subscription.canceled' ||
      event.type === 'subscription.cancelled' ||
      event.type === 'subscription.failed' ||
      event.type === 'subscription.on_hold'
    ) {
      const revokeEmail = event.data?.customer?.email
        || event.data?.metadata?.email
        || null
      const revokeCustomerId = event.data?.customer?.customer_id
        || event.data?.customer_id
        || null
      let revokeUserId = event.data?.metadata?.user_id
        || event.data?.metadata?.reference
        || event.data?.reference
        || null

      if (!revokeUserId && revokeEmail) {
        const { data: byEmail } = await supabase
          .from('user_profiles')
          .select('user_id')
          .ilike('email', revokeEmail)
          .maybeSingle()
        if (byEmail?.user_id) revokeUserId = byEmail.user_id
      }
      if (!revokeUserId && revokeCustomerId) {
        const { data: byCustomer } = await supabase
          .from('user_profiles')
          .select('user_id')
          .eq('dodo_customer_id', revokeCustomerId)
          .maybeSingle()
        if (byCustomer?.user_id) revokeUserId = byCustomer.user_id
      }

      if (revokeUserId) {
        const { error: downgradeError } = await supabase
          .from('user_profiles')
          .update({
            plan: 'free',
            plan_source: 'dodo_refund',
            plan_expires_at: null,
            // Clear team fields so a returning buyer starts fresh.
            // dodo_customer_id + plan_started_at are preserved for
            // audit / re-purchase-attribution paths.
            team_owner_id: null,
            team_seats: 1,
          })
          .eq('user_id', revokeUserId)

        if (downgradeError) {
          log.error('Failed to downgrade user on refund', {
            userId: revokeUserId,
            eventType: event.type,
            error: downgradeError.message,
          })
        } else {
          log.info('User downgraded on refund', {
            userId: revokeUserId,
            eventType: event.type,
          })

          // Refund confirmation email — only for actual refund events,
          // not subscription cancellations (those are user-initiated
          // and don't need an "we've refunded you" note).
          if (revokeEmail && event.type === 'refund.succeeded') {
            try {
              const resendKey = Deno.env.get('RESEND_API_KEY')
              if (resendKey) {
                const refundAmountMinor = event.data?.total_amount ?? event.data?.amount ?? null
                const refundCurrency = String(event.data?.currency || 'USD').toUpperCase()
                const refundFmt = refundAmountMinor != null
                  ? `${(refundAmountMinor / 100).toFixed(2)} ${refundCurrency}`
                  : ''
                const escR = (s: string = '') => String(s).replace(/[&<>"']/g, (c) => (
                  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
                ))
                const refundHtml = `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0A0A0A;">
                    <div style="font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #666; font-weight: 700; margin-bottom: 12px;">Cue · Refund confirmation</div>
                    <h2 style="margin: 0 0 14px; font-family: Georgia, serif; font-style: italic; font-weight: 400; font-size: 28px; color: #0A0A0A; line-height: 1.15;">
                      Your refund is on its way.
                    </h2>
                    <p style="font-size: 14.5px; line-height: 1.7; color: #333; margin: 0 0 16px;">
                      We've issued a refund${refundFmt ? ` of <strong>${escR(refundFmt)}</strong>` : ''} back to your original payment method. Depending on your bank, it typically lands within 5–10 business days.
                    </p>
                    <p style="font-size: 14.5px; line-height: 1.7; color: #333; margin: 0 0 20px;">
                      Your Cue+ access has been revoked as of now. If this was a mistake or you'd like to be re-enabled, just reply to this email — I read every message.
                    </p>
                    <div style="padding: 12px 16px; background: #f5f5f5; border-radius: 6px; font-size: 12.5px; color: #666; margin: 20px 0;">
                      No questions asked, no hard feelings. Cue's a small operation and refunds happen — sometimes the fit isn't right, sometimes timing's off. Feedback on why is appreciated but not required.
                    </div>
                    <p style="margin: 20px 0 4px; font-size: 14px; color: #333;">— Alok, Cue</p>
                    <p style="margin: 0; font-size: 11.5px; color: #999;">
                      <a href="https://www.cuedesign.space" style="color: #999; text-decoration: none;">cuedesign.space</a> · <a href="mailto:hello@cuedesign.space" style="color: #999;">hello@cuedesign.space</a>
                    </p>
                  </div>
                `
                const resp = await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${resendKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    from: 'Alok — Cue <hello@cuedesign.space>',
                    to: revokeEmail,
                    reply_to: 'hello@cuedesign.space',
                    subject: 'Refund confirmed — Cue',
                    html: refundHtml,
                  }),
                })
                if (resp.ok) {
                  log.info('Refund confirmation email sent', { email: revokeEmail })
                } else {
                  const t = await resp.text()
                  log.warn('Refund confirmation email failed', {
                    email: revokeEmail,
                    status: resp.status,
                    body: t.slice(0, 300),
                  })
                }
              }
            } catch (e: any) {
              log.warn('Refund confirmation email threw', { error: e?.message })
            }

            // ---- Founder alert email — every refund pings Alok too ----
            try {
              const resendKey = Deno.env.get('RESEND_API_KEY')
              const founderInbox = (Deno.env.get('FOUNDER_EMAIL') || 'aloksivastava1025@gmail.com').trim()
              if (resendKey) {
                const refundAmountMinor = event.data?.total_amount ?? event.data?.amount ?? null
                const refundCurrency = String(event.data?.currency || 'USD').toUpperCase()
                const refundFmt = refundAmountMinor != null
                  ? `${(refundAmountMinor / 100).toFixed(2)} ${refundCurrency}`
                  : ''
                const paymentIdR = event.data?.payment_id || event.data?.id || null
                const escR2 = (s: string = '') => String(s).replace(/[&<>"']/g, (c) => (
                  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
                ))
                const founderRefundHtml = `
                  <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0A0A0A;">
                    <div style="font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #cc4400; font-weight: 700; margin-bottom: 12px;">Cue · Refund issued</div>
                    <h2 style="margin: 0 0 14px; font-family: Georgia, serif; font-style: italic; font-weight: 400; font-size: 26px; color: #0A0A0A; line-height: 1.15;">
                      ${escR2(revokeEmail || 'A customer')} was refunded
                    </h2>
                    <table style="border-collapse: collapse; font-size: 14px; margin-bottom: 16px; width: 100%;">
                      <tr><td style="padding: 4px 12px 4px 0; color: #666; width: 100px;">Customer</td><td style="padding: 4px 0;"><a href="mailto:${escR2(revokeEmail || '')}" style="color: #0000FF;">${escR2(revokeEmail || '(unknown)')}</a></td></tr>
                      <tr><td style="padding: 4px 12px 4px 0; color: #666;">Amount</td><td style="padding: 4px 0; font-weight: 600;">${escR2(refundFmt)}</td></tr>
                      ${paymentIdR ? `<tr><td style="padding: 4px 12px 4px 0; color: #666;">Payment ID</td><td style="padding: 4px 0; font-family: Menlo, monospace; font-size: 12px;">${escR2(paymentIdR)}</td></tr>` : ''}
                      <tr><td style="padding: 4px 12px 4px 0; color: #666;">Access</td><td style="padding: 4px 0;">Revoked — user downgraded to free</td></tr>
                    </table>
                    <p style="margin: 20px 0 4px; font-size: 12px; color: #999;">Auto-generated from dodo-webhook · reply lands in your inbox</p>
                  </div>
                `
                const alertResp = await fetch('https://api.resend.com/emails', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${resendKey}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    from: 'Cue Sales <hello@cuedesign.space>',
                    to: founderInbox,
                    reply_to: revokeEmail || undefined,
                    subject: `Refund issued — ${revokeEmail || 'customer'}`,
                    html: founderRefundHtml,
                  }),
                })
                if (alertResp.ok) {
                  log.info('Founder refund alert sent', { founderInbox })
                } else {
                  const t = await alertResp.text()
                  log.warn('Founder refund alert failed', {
                    status: alertResp.status,
                    body: t.slice(0, 300),
                  })
                }
              }
            } catch (e: any) {
              log.warn('Founder refund alert threw', { error: e?.message })
            }
          }
        }
      } else {
        log.warn('Refund event with no attributable user', {
          eventType: event.type,
          revokeEmail,
          revokeCustomerId,
        })
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
