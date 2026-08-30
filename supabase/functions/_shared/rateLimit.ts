// ============================================================
// Cue — per-IP rate limit helper (Supabase-backed)
// ============================================================
// Uses the `rate_limit_windows` table (key, count, reset_at) to
// throttle abuse of the anonymous edge functions. Every function
// that accepts anon POSTs (hire-notify, custom-pack-notify,
// send-contact, upload-to-r2 pre-auth path) should call
// `enforceIpRateLimit` before doing meaningful work.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

/**
 * Enforce a per-IP window. Returns null if the request is allowed,
 * or a Response object (HTTP 429) if the caller has exceeded the
 * limit. Fails-open on DB errors so a transient outage never
 * denies legitimate submissions.
 *
 * @param req         incoming Request (we read x-forwarded-for)
 * @param scope       short string identifying the endpoint
 *                    (e.g. "hire-notify") — shared across calls
 * @param max         allowed requests inside the window
 * @param windowMs    window length in milliseconds (default 1 hour)
 * @param corsHdrs    CORS headers to attach to the 429 response
 */
export async function enforceIpRateLimit(
  req: Request,
  scope: string,
  max: number,
  windowMs: number,
  corsHdrs: Record<string, string>,
): Promise<Response | null> {
  const ip = (req.headers.get('cf-connecting-ip')
    || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown')
  const key = `${scope}:${ip}`
  try {
    const supa = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '',
    )
    const now = Date.now()
    const { data: row } = await supa
      .from('rate_limit_windows')
      .select('count, reset_at')
      .eq('key', key)
      .maybeSingle()
    if (row && new Date(row.reset_at).getTime() > now && row.count >= max) {
      const retrySec = Math.max(1, Math.floor((new Date(row.reset_at).getTime() - now) / 1000))
      return new Response(JSON.stringify({
        error: 'Too many requests. Please wait before trying again.',
        retryAfter: retrySec,
      }), {
        status: 429,
        headers: { ...corsHdrs, 'Content-Type': 'application/json', 'Retry-After': String(retrySec) },
      })
    }
    const nextResetIso = row && new Date(row.reset_at).getTime() > now
      ? row.reset_at
      : new Date(now + windowMs).toISOString()
    const nextCount = row && new Date(row.reset_at).getTime() > now
      ? row.count + 1
      : 1
    await supa
      .from('rate_limit_windows')
      .upsert({ key, count: nextCount, reset_at: nextResetIso }, { onConflict: 'key' })
  } catch (_) {
    // Fail-open — do not block real submissions if the DB blips.
  }
  return null
}
