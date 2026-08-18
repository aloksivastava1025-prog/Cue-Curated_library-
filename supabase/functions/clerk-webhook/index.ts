// ============================================================
// CUE v2.0 — Clerk Webhook (Production-Hardened)
// ============================================================
// Handles Clerk webhook events, specifically `user.deleted` to
// trigger the `delete_user_cascade` DPDP compliance function.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { Webhook } from "https://esm.sh/svix@1.15.0"

// Structured logger
function createLogger(requestId: string) {
  const base = { service: 'clerk-webhook', requestId }
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

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  const SIGNING_SECRET = Deno.env.get('CLERK_WEBHOOK_SECRET')

  if (!SIGNING_SECRET) {
    log.error('CLERK_WEBHOOK_SECRET is not configured')
    return new Response('Error: Please configure CLERK_WEBHOOK_SECRET', {
      status: 500,
    })
  }

  // Get the headers and body
  const svix_id = req.headers.get('svix-id')
  const svix_timestamp = req.headers.get('svix-timestamp')
  const svix_signature = req.headers.get('svix-signature')

  if (!svix_id || !svix_timestamp || !svix_signature) {
    log.warn('Missing svix headers')
    return new Response('Error: Missing Svix headers', {
      status: 400,
    })
  }

  const payload = await req.text()
  const wh = new Webhook(SIGNING_SECRET)

  let evt: any
  try {
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    })
  } catch (err: any) {
    log.error('Webhook verification failed', { error: err.message })
    return new Response('Error: Verification error', {
      status: 400,
    })
  }

  const { type, data } = evt

  if (type === 'user.deleted') {
    const userId = data.id

    if (!userId) {
      log.warn('No user ID found in user.deleted event')
      return new Response('OK', { status: 200 })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Call the cascade delete function
    const { error } = await supabase.rpc('delete_user_cascade', {
      p_user_id: userId,
    })

    if (error) {
      log.error('Failed to cascade delete user data', { userId, error: error.message })
      return new Response('Error: Database operation failed', { status: 500 })
    }

    log.info('User data successfully cascaded deleted', { userId })
  } else {
    log.info('Ignoring unhandled Clerk webhook event', { type })
  }

  return new Response('Webhook received', { status: 200 })
})
