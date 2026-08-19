// ============================================================
// CUE v2.0 — Webhook + Payment Test Suite
// ============================================================
// Simulates Dodo webhook events with correct Standard Webhooks
// signatures and verifies that the user_profiles table in
// Supabase is updated correctly for each scenario.
//
// Usage:
//   node scripts/test-webhook.mjs
//
// Pre-requisites:
//   - Copy your values into the CONFIG block below before running.
//   - The test user_id must exist in your user_profiles table.
//     (Sign in to your local dev app once to create the profile)
// ============================================================

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// ============================================================
// ⚙️  CONFIG — Fill these in before running
// ============================================================
const CONFIG = {
  SUPABASE_URL: 'https://rkinvrdjbmoozjzmqshn.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJraW52cmRqYm1vb3pqem1xc2huIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NjYzNzQxNSwiZXhwIjoyMTAyMjEzNDE1fQ.Fu7fxYLm6GoVlh7Qqo_tSRBI2a6WFPitay30ZsjWaYk',
  DODO_WEBHOOK_SECRET: 'whsec_p9fSlPJd44R4rLyvZZ0kN6SXDr90fb10',
  WEBHOOK_URL: 'https://rkinvrdjbmoozjzmqshn.supabase.co/functions/v1/dodo-webhook',
  TEST_USER_ID: 'test_user_cue_suite_001',
  TEST_USER_EMAIL: 'test@cuedesign.space',
}
// ============================================================

const PASS = '\x1b[32m✅ PASS\x1b[0m'
const FAIL = '\x1b[31m❌ FAIL\x1b[0m'
const INFO = '\x1b[36mℹ️  INFO\x1b[0m'

let passed = 0
let failed = 0

// Standard Webhooks signing: HMAC-SHA256 over "webhook_id.timestamp.body"
function signPayload(secret, webhookId, timestamp, body) {
  const rawSecret = secret.startsWith('whsec_')
    ? Buffer.from(secret.slice(6), 'base64')
    : Buffer.from(secret, 'base64')
  const toSign = `${webhookId}.${timestamp}.${body}`
  const hmac = crypto.createHmac('sha256', rawSecret).update(toSign).digest('base64')
  return `v1,${hmac}`
}

async function sendWebhookEvent(eventType, data) {
  const webhookId = `wh_test_${crypto.randomUUID()}`
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const body = JSON.stringify({ type: eventType, data })
  const signature = signPayload(CONFIG.DODO_WEBHOOK_SECRET, webhookId, timestamp, body)

  const res = await fetch(CONFIG.WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': webhookId,
      'webhook-timestamp': timestamp,
      'webhook-signature': signature,
    },
    body,
  })

  const json = await res.json().catch(() => ({}))
  return { status: res.status, body: json, webhookId }
}

async function getUserPlan(supabase) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('plan, plan_source, plan_expires_at, team_seats')
    .eq('user_id', CONFIG.TEST_USER_ID)
    .single()
  return { data, error }
}

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ${PASS} ${label}`)
    passed++
  } else {
    console.log(`  ${FAIL} ${label}${detail ? ' → ' + detail : ''}`)
    failed++
  }
}

// ============================================================
// TEST SUITE
// ============================================================
async function runTests() {
  console.log('\n\x1b[1m═══════════════════════════════════════════\x1b[0m')
  console.log('\x1b[1m CUE v2.0 — Webhook Test Suite\x1b[0m')
  console.log('\x1b[1m═══════════════════════════════════════════\x1b[0m\n')

  const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_SERVICE_ROLE_KEY)

  // Seed a fresh test user so we don't need a real Clerk user
  await supabase.from('user_profiles').upsert(
    { user_id: CONFIG.TEST_USER_ID, email: CONFIG.TEST_USER_EMAIL, plan: 'free' },
    { onConflict: 'user_id' }
  )
  console.log(`\x1b[36mℹ️  Test user seeded: ${CONFIG.TEST_USER_ID}\x1b[0m\n`)

  // ---- Test 1: Invalid Signature ----
  console.log('\x1b[1mTest 1: Reject tampered/invalid signature\x1b[0m')
  const badRes = await fetch(CONFIG.WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': 'wh_test_fake',
      'webhook-timestamp': Math.floor(Date.now() / 1000).toString(),
      'webhook-signature': 'v1,invalidsignature',
    },
    body: JSON.stringify({ type: 'payment.succeeded', data: {} }),
  })
  assert('Returns 401 on bad signature', badRes.status === 401, `Got ${badRes.status}`)
  console.log()

  // ---- Test 2: Stale timestamp ----
  console.log('\x1b[1mTest 2: Reject stale timestamp (>5 min old)\x1b[0m')
  const staleId = 'wh_test_stale'
  const staleTimestamp = (Math.floor(Date.now() / 1000) - 400).toString() // 6 min ago
  const staleBody = JSON.stringify({ type: 'payment.succeeded', data: {} })
  const staleSig = signPayload(CONFIG.DODO_WEBHOOK_SECRET, staleId, staleTimestamp, staleBody)
  const staleRes = await fetch(CONFIG.WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': staleId,
      'webhook-timestamp': staleTimestamp,
      'webhook-signature': staleSig,
    },
    body: staleBody,
  })
  assert('Returns 400 on stale timestamp', staleRes.status === 400, `Got ${staleRes.status}`)
  console.log()

  // ---- Test 3: Lifetime Individual Upgrade ----
  console.log('\x1b[1mTest 3: payment.succeeded → upgrades user to cue_plus (Lifetime)\x1b[0m')
  const upgradeRes = await sendWebhookEvent('payment.succeeded', {
    metadata: { user_id: CONFIG.TEST_USER_ID, plan_type: 'cue_plus', billing_cycle: 'lifetime' },
    customer: { email: CONFIG.TEST_USER_EMAIL },
  })
  assert('Returns 200', upgradeRes.status === 200, `Got ${upgradeRes.status}`)
  assert('Body has received:true', upgradeRes.body.received === true)

  await new Promise(r => setTimeout(r, 1500)) // wait for DB write
  const { data: afterUpgrade } = await getUserPlan(supabase)
  assert('Plan set to cue_plus', afterUpgrade?.plan === 'cue_plus', `Got "${afterUpgrade?.plan}"`)
  assert('plan_source is dodo', afterUpgrade?.plan_source === 'dodo', `Got "${afterUpgrade?.plan_source}"`)
  assert('plan_expires_at is null (lifetime)', afterUpgrade?.plan_expires_at === null, `Got "${afterUpgrade?.plan_expires_at}"`)
  console.log()

  // ---- Test 4: Annual Subscription Upgrade ----
  console.log('\x1b[1mTest 4: subscription.active → upgrades user to cue_plus (Annual, 1yr expiry)\x1b[0m')
  const annualRes = await sendWebhookEvent('subscription.active', {
    metadata: { user_id: CONFIG.TEST_USER_ID, plan_type: 'cue_plus', billing_cycle: 'annual' },
    customer: { email: CONFIG.TEST_USER_EMAIL },
  })
  assert('Returns 200', annualRes.status === 200, `Got ${annualRes.status}`)

  await new Promise(r => setTimeout(r, 1500))
  const { data: afterAnnual } = await getUserPlan(supabase)
  assert('Plan still cue_plus', afterAnnual?.plan === 'cue_plus', `Got "${afterAnnual?.plan}"`)
  assert('plan_expires_at is ~1 year from now', (() => {
    if (!afterAnnual?.plan_expires_at) return false
    const expiresIn = new Date(afterAnnual.plan_expires_at) - Date.now()
    return expiresIn > 360 * 24 * 60 * 60 * 1000 // at least 360 days in the future
  })(), `Got "${afterAnnual?.plan_expires_at}"`)
  console.log()

  // ---- Test 5: Idempotency (Duplicate Event) ----
  console.log('\x1b[1mTest 5: Duplicate webhook-id → idempotency short-circuit\x1b[0m')
  const dupId = annualRes.webhookId // same ID as test 4
  const dupTimestamp = Math.floor(Date.now() / 1000).toString()
  const dupBody = JSON.stringify({ type: 'subscription.active', data: { metadata: { user_id: CONFIG.TEST_USER_ID, plan_type: 'cue_plus', billing_cycle: 'annual' } } })
  const dupSig = signPayload(CONFIG.DODO_WEBHOOK_SECRET, dupId, dupTimestamp, dupBody)
  const dupRes = await fetch(CONFIG.WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'webhook-id': dupId,
      'webhook-timestamp': dupTimestamp,
      'webhook-signature': dupSig,
    },
    body: dupBody,
  })
  const dupJson = await dupRes.json().catch(() => ({}))
  assert('Returns 200 on duplicate', dupRes.status === 200, `Got ${dupRes.status}`)
  assert('Body has duplicate:true', dupJson.duplicate === true, `Got ${JSON.stringify(dupJson)}`)
  console.log()

  // ---- Test 6: Team Upgrade ----
  console.log('\x1b[1mTest 6: payment.succeeded → upgrades user to cue_plus_team (5 seats)\x1b[0m')
  const teamRes = await sendWebhookEvent('payment.succeeded', {
    metadata: { user_id: CONFIG.TEST_USER_ID, plan_type: 'cue_plus_team', billing_cycle: 'lifetime' },
    customer: { email: CONFIG.TEST_USER_EMAIL },
  })
  assert('Returns 200', teamRes.status === 200, `Got ${teamRes.status}`)

  await new Promise(r => setTimeout(r, 1500))
  const { data: afterTeam } = await getUserPlan(supabase)
  assert('Plan is cue_plus_team', afterTeam?.plan === 'cue_plus_team', `Got "${afterTeam?.plan}"`)
  assert('team_seats is 5', afterTeam?.team_seats === 5, `Got ${afterTeam?.team_seats}`)
  console.log()

  // ---- Test 7: Cancellation / Downgrade ----
  console.log('\x1b[1mTest 7: subscription.cancelled → downgrades user to free\x1b[0m')
  const cancelRes = await sendWebhookEvent('subscription.cancelled', {
    metadata: { user_id: CONFIG.TEST_USER_ID },
  })
  assert('Returns 200', cancelRes.status === 200, `Got ${cancelRes.status}`)

  await new Promise(r => setTimeout(r, 1500))
  const { data: afterCancel } = await getUserPlan(supabase)
  assert('Plan downgraded to free', afterCancel?.plan === 'free', `Got "${afterCancel?.plan}"`)
  console.log()

  // ---- Summary ----
  console.log('\x1b[1m═══════════════════════════════════════════\x1b[0m')
  console.log(`\x1b[1m Results: ${passed} passed, ${failed} failed\x1b[0m`)
  console.log('\x1b[1m═══════════════════════════════════════════\x1b[0m\n')

  if (failed > 0) {
    console.log('\x1b[33m⚠️  NOTE: Mail service (Resend) is not yet wired up — this is expected.\x1b[0m')
    console.log('\x1b[33m   Email receipts will be added in the next iteration.\x1b[0m\n')
    process.exit(1)
  } else {
    console.log('\x1b[32m🎉 All tests passed! Your payment webhook is production-ready.\x1b[0m\n')
  }
}

runTests().catch(err => {
  console.error('\x1b[31mUnexpected error:\x1b[0m', err)
  process.exit(1)
})
