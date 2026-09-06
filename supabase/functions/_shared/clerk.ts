// ============================================================
// Cue — Clerk JWT verification helper (shared by edge fns)
// ============================================================
// Every user-scoped edge function must verify the caller's Clerk
// JWT before trusting body-supplied user_id / email. Prior to this
// helper each function trusted body inputs, which meant any
// unauthenticated attacker could impersonate any user (see the
// pre-launch security audit — #2, #3, #5, #6, #7, #9).
//
// verifyClerkJwt(req) → { sub, email } | throws
//   - Reads Bearer token from Authorization
//   - Verifies signature against Clerk's JWKS
//   - Returns the verified subject (Clerk user_id) and email
//
// CLERK_JWKS_URL env var required (usually
// https://<your-instance>.clerk.accounts.dev/.well-known/jwks.json).
// ============================================================

import { jwtVerify, createRemoteJWKSet } from 'https://esm.sh/jose@5.9.6'

// Support MULTIPLE JWKS URLs — one instance per URL. Verifies
// against them in order until one matches. This is what lets a
// single edge function accept tokens from both the production
// Clerk instance (clerk.cuedesign.space) AND the development
// instance (perfect-goldfish-15.clerk.accounts.dev) at the same
// time. Set CLERK_JWKS_URL to a comma-separated list.
//
//   CLERK_JWKS_URL=https://clerk.cuedesign.space/.well-known/jwks.json,https://perfect-goldfish-15.clerk.accounts.dev/.well-known/jwks.json
let jwksCache: Array<ReturnType<typeof createRemoteJWKSet>> | null = null

function getJwksList() {
  if (jwksCache) return jwksCache
  const raw = Deno.env.get('CLERK_JWKS_URL')
  if (!raw) throw new Error('CLERK_JWKS_URL not configured')
  const urls = raw.split(',').map(s => s.trim()).filter(Boolean)
  if (!urls.length) throw new Error('CLERK_JWKS_URL is empty')
  jwksCache = urls.map(u => createRemoteJWKSet(new URL(u), {
    cooldownDuration: 30_000,
    cacheMaxAge: 600_000,
  }))
  return jwksCache
}

export type ClerkClaims = {
  sub: string          // Clerk user_id
  email?: string
  raw: Record<string, unknown>
}

/**
 * Verify a request's Clerk JWT. Throws on missing/invalid.
 * Returns the verified sub + email (email comes from custom claim
 * — Clerk exposes it under `email` if the JWT template is set,
 * otherwise we fall back to fetching it via Clerk Backend API in
 * a downstream helper, but every function in this repo already
 * requires an email claim in its JWT template).
 */
export async function verifyClerkJwt(req: Request): Promise<ClerkClaims> {
  const auth = req.headers.get('Authorization') || ''
  const m = auth.match(/^Bearer\s+(.+)$/i)
  if (!m) throw new Error('Missing Authorization Bearer token')
  const token = m[1].trim()
  const jwksList = getJwksList()

  // Try each configured JWKS URL in order — first one whose keys
  // match the token's kid wins. This is what lets prod tokens
  // (clerk.cuedesign.space) and dev tokens (*.clerk.accounts.dev)
  // both authenticate against the same edge function.
  let lastErr: unknown = null
  for (const jwks of jwksList) {
    try {
      const { payload } = await jwtVerify(token, jwks, {})
      const sub = String(payload.sub || '')
      if (!sub) throw new Error('Missing sub in JWT')
      const email = typeof payload.email === 'string'
        ? payload.email
        : (typeof (payload as Record<string, unknown>).email_address === 'string'
            ? String((payload as Record<string, unknown>).email_address)
            : undefined)
      return { sub, email, raw: payload as Record<string, unknown> }
    } catch (e) {
      lastErr = e
      // Try next JWKS. Only rethrow if all fail.
    }
  }
  throw (lastErr instanceof Error ? lastErr : new Error('JWT verification failed'))
}

/**
 * Convenience — verify and require the caller be on the admin
 * allowlist. Throws otherwise. Returns { sub, email } on success.
 */
const ADMIN_EMAILS = new Set([
  'aloks.int@teachforindia.org',
  'aloksivastava1025@gmail.com',
  'akashkumar7653099@gmail.com',
  'srivastavaalok2214@gmail.com',
])

// Fallback admin allowlist by Clerk user_id (sub). Used when the
// JWT doesn't carry email AND the Clerk Backend API email lookup
// fails. Root cause of that gap: localhost app uses the DEV Clerk
// instance (perfect-goldfish-15.*.clerk.accounts.dev, pk_test_...)
// whose sub prefix + user_ids differ from the PROD instance
// (clerk.cuedesign.space, pk_live_...). Supabase's CLERK_SECRET_KEY
// belongs to only one instance, so the email lookup 404s across
// instances. Whitelisting per-instance subs sidesteps this.
//
// To capture a new admin's sub for either instance: sign in on that
// instance, trigger any admin action, read the sub from the 403
// error message ("sub=user_XXXX email=..."), add it here, redeploy.
const ADMIN_SUBS = new Set<string>([
  // Prod instance (clerk.cuedesign.space)
  'user_31bXQx3zTdMz6zoZK6vpFxALWO2',
  // Dev instance (perfect-goldfish-15.clerk.accounts.dev) — Alok
  'user_3GfanvjqsMNa5vaOKgaGA8tURKE',
])

// Fetch a user's primary email via Clerk Backend API when the JWT
// itself doesn't carry it (Clerk's default session token OMITS
// email unless a custom JWT template adds it). Uses CLERK_SECRET_KEY.
// Returns lowercase email string or empty string on any failure —
// caller decides how to react.
async function fetchClerkEmail(sub: string): Promise<string> {
  const key = Deno.env.get('CLERK_SECRET_KEY')
  if (!key || !sub) return ''
  try {
    const r = await fetch(`https://api.clerk.com/v1/users/${encodeURIComponent(sub)}`, {
      headers: { Authorization: `Bearer ${key}` },
    })
    if (!r.ok) return ''
    const j = await r.json()
    const primaryId = j?.primary_email_address_id
    const found = Array.isArray(j?.email_addresses)
      ? j.email_addresses.find((e: { id?: string }) => e?.id === primaryId)
        || j.email_addresses[0]
      : null
    return String(found?.email_address || '').toLowerCase()
  } catch { return '' }
}

export async function verifyClerkAdmin(req: Request): Promise<ClerkClaims> {
  const claims = await verifyClerkJwt(req)
  let em = (claims.email || '').toLowerCase()
  // Fallback — default Clerk session tokens don't include email.
  // Look it up via Clerk Backend API. Slower (one extra hop) but
  // guarantees admin gate works regardless of JWT template config.
  if (!em) {
    em = await fetchClerkEmail(claims.sub)
    if (em) claims.email = em
  }
  // Accept EITHER a whitelisted email OR a whitelisted Clerk sub.
  // Sub-based fallback is what saves us when the email lookup
  // fails (dev/prod Clerk instance secret mismatch).
  const emailOk = em && ADMIN_EMAILS.has(em)
  const subOk = claims.sub && ADMIN_SUBS.has(claims.sub)
  if (!emailOk && !subOk) {
    // Include sub in the error so we can whitelist it if this is a
    // legitimate admin whose Clerk id we haven't captured yet.
    throw new Error(`Not authorised: admin only (sub=${claims.sub || 'none'} email=${em || 'none'})`)
  }
  return claims
}

/**
 * Simple auth JSON response builder — every consumer uses the
 * same 401/403 shape.
 */
export function authErrorResponse(err: unknown, corsHdrs: Record<string, string>) {
  const msg = err instanceof Error ? err.message : String(err)
  const isForbidden = /admin only|not authorised/i.test(msg)
  return new Response(JSON.stringify({ error: msg }), {
    status: isForbidden ? 403 : 401,
    headers: { ...corsHdrs, 'Content-Type': 'application/json' },
  })
}
