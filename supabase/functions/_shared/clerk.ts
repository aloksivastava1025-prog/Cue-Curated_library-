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

let jwksSingleton: ReturnType<typeof createRemoteJWKSet> | null = null

function getJwks() {
  if (jwksSingleton) return jwksSingleton
  const url = Deno.env.get('CLERK_JWKS_URL')
  if (!url) throw new Error('CLERK_JWKS_URL not configured')
  jwksSingleton = createRemoteJWKSet(new URL(url), {
    cooldownDuration: 30_000,
    cacheMaxAge: 600_000,
  })
  return jwksSingleton
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
  const jwks = getJwks()
  const { payload } = await jwtVerify(token, jwks, {
    // Clerk tokens include iss, sub, exp, nbf, iat — jose handles
    // exp/nbf/iat by default. We only need the sub.
  })
  const sub = String(payload.sub || '')
  if (!sub) throw new Error('Missing sub in JWT')
  const email = typeof payload.email === 'string'
    ? payload.email
    : (typeof (payload as Record<string, unknown>).email_address === 'string'
        ? String((payload as Record<string, unknown>).email_address)
        : undefined)
  return { sub, email, raw: payload as Record<string, unknown> }
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

export async function verifyClerkAdmin(req: Request): Promise<ClerkClaims> {
  const claims = await verifyClerkJwt(req)
  const em = (claims.email || '').toLowerCase()
  if (!em || !ADMIN_EMAILS.has(em)) {
    throw new Error('Not authorised: admin only')
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
