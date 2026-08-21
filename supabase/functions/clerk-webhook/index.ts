// ============================================================
// CUE — Clerk webhook handler
//
// Receives user.deleted events from Clerk and cascades the deletion
// across every CUE table that holds that user's data (DPDP compliance).
//
// Only user.deleted is wired for now; user.created / user.updated are
// accepted with 200 OK so Clerk's dashboard doesn't flag them as
// failures, but they don't trigger any action yet.
//
// Deploy:
//   supabase functions deploy clerk-webhook
//
// Secrets required (Supabase Dashboard → Edge Functions → Secrets):
//   CLERK_WEBHOOK_SECRET      — from Clerk Dashboard → Webhooks → your endpoint
//   SUPABASE_URL              — auto-populated by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — from Supabase Settings → API (⚠️ god key)
// ============================================================

import { serve }         from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient }  from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { Webhook }       from 'https://esm.sh/svix@1.15.0'

const CLERK_WEBHOOK_SECRET = Deno.env.get('CLERK_WEBHOOK_SECRET')
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL')
const SERVICE_ROLE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

const cors = {
  'Access-Control-Allow-Origin':  '*', // webhooks come from Clerk, not browsers
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function log(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), event, ...data }))
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: cors })
  }

  if (!CLERK_WEBHOOK_SECRET || !SUPABASE_URL || !SERVICE_ROLE_KEY) {
    log('config_missing', {
      hasSecret:      Boolean(CLERK_WEBHOOK_SECRET),
      hasSupabaseUrl: Boolean(SUPABASE_URL),
      hasServiceKey:  Boolean(SERVICE_ROLE_KEY),
    })
    return new Response('Server misconfigured', { status: 500, headers: cors })
  }

  // ---------- 1. Verify signature -----------------------------------
  const svixId        = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    log('missing_svix_headers')
    return new Response('Missing headers', { status: 400, headers: cors })
  }

  const body = await req.text()
  const wh = new Webhook(CLERK_WEBHOOK_SECRET)
  let event: any
  try {
    event = wh.verify(body, {
      'svix-id':        svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    })
  } catch (err) {
    log('signature_verify_failed', { error: String(err) })
    return new Response('Invalid signature', { status: 401, headers: cors })
  }

  // ---------- 2. Route by event type --------------------------------
  const type = event?.type as string | undefined
  const data = event?.data ?? {}
  const userId = data?.id as string | undefined

  // ---- user.created → insert user_profiles row + send welcome email --
  if (type === 'user.created') {
    const emailAddr = (data?.email_addresses || [])
      .find((e: any) => e?.id === data?.primary_email_address_id)?.email_address
      || (data?.email_addresses?.[0]?.email_address)
      || ''
    const firstName = data?.first_name || ''

    // Pre-create the user_profiles row keyed on Clerk userId so any
    // subsequent Dodo purchase attribution finds this row directly
    // (avoids the self-heal `dodo:...` / `email:...` orphan path).
    if (userId && emailAddr) {
      try {
        const supabaseEarly = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
        await supabaseEarly
          .from('user_profiles')
          .upsert({
            user_id: userId,
            email: emailAddr.toLowerCase(),
            plan: 'free',
            plan_source: 'clerk_signup',
          }, { onConflict: 'user_id' })
        log('profile_row_created', { userId, emailAddr })
      } catch (err) {
        // Non-fatal — ensureUserProfile client-side will retry on first
        // app visit. We still want the welcome email to go out.
        log('profile_row_create_failed', { userId, error: String(err) })
      }
    }

    if (emailAddr) {
      // Invoke send-signup-welcome inline and log the outcome. Previously
      // used EdgeRuntime.waitUntil() with a .catch that swallowed errors,
      // and the fetch itself was silently dropping — 0 downstream
      // invocations despite this branch running. Inline await adds a
      // few hundred ms to webhook completion, well within Clerk's
      // 15-second webhook timeout, in exchange for real reliability.
      const url = `${SUPABASE_URL}/functions/v1/send-signup-welcome`
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
            'apikey': SERVICE_ROLE_KEY,
          },
          body: JSON.stringify({ email: emailAddr, firstName }),
        })
        const bodyText = await resp.text().catch(() => '')
        if (resp.ok) {
          log('signup_welcome_dispatched', { userId, emailAddr, status: resp.status })
        } else {
          log('signup_welcome_failed', {
            userId, emailAddr,
            status: resp.status,
            body: bodyText.slice(0, 300),
          })
        }
      } catch (err) {
        log('signup_welcome_threw', { userId, emailAddr, error: String(err).slice(0, 300) })
      }
    } else {
      log('user_created_no_email', { userId })
    }
    return new Response(JSON.stringify({ received: true, action: 'welcomed', userId }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (type !== 'user.deleted') {
    // Accept but no-op — Clerk sends multiple event types; unsubscribed
    // ones return 200 so the endpoint stays green in Clerk dashboard.
    log('event_ignored', { type })
    return new Response(JSON.stringify({ received: true, action: 'ignored', type }), {
      status: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  if (!userId) {
    log('user_deleted_missing_id', { data })
    return new Response('Missing user id', { status: 400, headers: cors })
  }

  // ---------- 3. Cascade delete via server-side RPC -----------------
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: result, error } = await supabase.rpc('delete_user_cascade', {
    p_user_id: userId,
  })

  if (error) {
    log('cascade_delete_failed', { userId, error: error.message })
    return new Response('Cascade delete failed', { status: 500, headers: cors })
  }

  log('user_deleted', { userId, result })

  return new Response(JSON.stringify({ received: true, action: 'deleted', userId }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
})
