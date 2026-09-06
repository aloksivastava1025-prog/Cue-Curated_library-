// ============================================================
// CUE — Send drop / feature notification email
// ============================================================
// Admin-triggered. Targets signed-up free-tier users (Cue+ members
// are skipped — they've already converted, no need to nudge). Body
// arrives as plain text; edge fn wraps it in a lightweight HTML
// shell with a single blue CTA button + mandatory unsubscribe link.
//
// Rate-safe: uses per-recipient delay + logs each send to
// email_send_log with UNIQUE(campaign_key, email) so an accidental
// double-click on "Send" doesn't send twice.
//
// Modes:
//   { mode: 'test',  to: 'x@x.com' }       — send single test email
//   { mode: 'bulk',  campaignKey: 'drop-YYYY-MM-DD' } — full send
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"
import { verifyClerkAdmin, authErrorResponse } from '../_shared/clerk.ts'

const ALLOWED_ORIGINS = [
  'https://cuedesign.space',
  'https://www.cuedesign.space',
]

// Allow the two prod hosts explicitly, plus any localhost port for
// dev (Vite's autoPort assigns random high ports when 5173 is taken
// by another project, so hardcoding a list quickly goes stale).
function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || ''
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
  const allowed = ALLOWED_ORIGINS.includes(origin) || isLocal ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
))

const UNSUB_BASE = 'https://rkinvrdjbmoozjzmqshn.supabase.co/functions/v1/unsubscribe-email'
const SITE_URL   = 'https://cuedesign.space'

function buildHtml({ bodyText, firstName, unsubToken, ctaLabel, ctaUrl }: {
  bodyText: string;
  firstName: string;
  unsubToken: string;
  ctaLabel: string;
  ctaUrl: string;
}) {
  // Preserve line breaks from the admin's textarea while escaping
  // any HTML in the raw text so a stray < in the body doesn't break
  // the layout.
  const bodyHtml = esc(bodyText).replace(/\n/g, '<br>')
  const unsubUrl = `${UNSUB_BASE}?token=${encodeURIComponent(unsubToken)}`
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0A0A0A;">
      <div style="font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #0000FF; font-weight: 700; margin-bottom: 16px;">
        Cue · New drop
      </div>
      <p style="font-size: 15px; line-height: 1.7; color: #0A0A0A; margin: 0 0 4px;">
        Hey ${esc(firstName || 'there')},
      </p>
      <div style="font-size: 15px; line-height: 1.7; color: #333; margin: 12px 0 24px;">
        ${bodyHtml}
      </div>
      <div style="margin: 24px 0;">
        <a href="${esc(ctaUrl)}"
           style="display: inline-block; padding: 12px 22px; background: #0000FF; color: #ffffff;
                  text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;
                  letter-spacing: 0.02em;">
          ${esc(ctaLabel)} →
        </a>
      </div>
      <p style="margin: 28px 0 4px; font-size: 14px; color: #333;">— Alok, Cue</p>
      <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0 14px;" />
      <p style="margin: 0; font-size: 11.5px; color: #999; line-height: 1.6;">
        You're getting this because you signed up at
        <a href="${SITE_URL}" style="color: #999;">cuedesign.space</a>.<br>
        <a href="${esc(unsubUrl)}" style="color: #999;">Unsubscribe</a>
        · <a href="mailto:hello@cuedesign.space" style="color: #999;">hello@cuedesign.space</a>
      </p>
    </div>
  `
}

serve(async (req) => {
  const headers = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers })

  try {
    await verifyClerkAdmin(req)
  } catch (err) {
    return authErrorResponse(err, headers)
  }

  try {
    const body = await req.json().catch(() => ({}))
    const mode        = String(body?.mode || 'test').toLowerCase() // 'test' | 'bulk'
    const subject     = String(body?.subject || '').trim().slice(0, 200)
    const bodyText    = String(body?.body || '').trim().slice(0, 10000)
    const ctaLabel    = String(body?.ctaLabel || 'Unlock with Cue+').trim().slice(0, 60)
    const ctaUrl      = String(body?.ctaUrl || `${SITE_URL}/#/pricing`).trim().slice(0, 500)
    const campaignKey = String(body?.campaignKey || '').trim().slice(0, 60)
    const testTo      = String(body?.to || '').trim().toLowerCase().slice(0, 320)

    if (!subject || !bodyText) {
      return new Response(JSON.stringify({ error: 'subject + body required' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY missing' }), {
        status: 500, headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Small helper — send one email via Resend. Doesn't throw; the
    // caller inspects `.ok` and logs accordingly so one bad address
    // doesn't nuke the batch.
    async function sendOne(toEmail: string, firstName: string, token: string) {
      const html = buildHtml({ bodyText, firstName, unsubToken: token, ctaLabel, ctaUrl })
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'Alok — Cue <hello@cuedesign.space>',
          to: toEmail,
          reply_to: 'hello@cuedesign.space',
          subject,
          html,
        }),
      })
      if (!resp.ok) {
        const t = await resp.text().catch(() => '')
        return { ok: false, id: null as string | null, error: t.slice(0, 300) }
      }
      const j = await resp.json().catch(() => ({} as any))
      return { ok: true, id: (j?.id as string) || null, error: null as string | null }
    }

    // -------- TEST MODE --------
    if (mode === 'test') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)) {
        return new Response(JSON.stringify({ error: 'valid `to` required for test mode' }), {
          status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }
      // Use a dummy token so the unsubscribe link in the preview is
      // clickable but won't actually flip real preferences.
      const r = await sendOne(testTo, 'there', 'test-token-noop')
      return new Response(JSON.stringify({
        mode: 'test', to: testTo, sent: r.ok, error: r.error, resend_id: r.id,
      }), {
        status: 200, headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // -------- BULK MODE --------
    if (!campaignKey) {
      return new Response(JSON.stringify({ error: 'campaignKey required for bulk mode' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Recipient set: signed-up users on free tier (plan is null OR
    // 'free' — NOT cue_plus/cue_plus_team). Drop rows with no email
    // (edge case for pre-webhook self-heal users) and dedupe on
    // lower(email) so alias variants don't get two emails.
    const { data: freeUsers, error: usersErr } = await supabase
      .from('user_profiles')
      .select('user_id, email, first_name, plan')
      .not('email', 'is', null)
      .or('plan.is.null,plan.eq.free')

    if (usersErr) {
      return new Response(JSON.stringify({ error: 'recipient query failed: ' + usersErr.message }), {
        status: 500, headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Fetch existing unsubscribes so we skip them.
    const { data: prefs } = await supabase
      .from('user_email_preferences')
      .select('email, unsubscribed')
      .eq('unsubscribed', true)
    const unsubSet = new Set((prefs || []).map(p => (p.email || '').toLowerCase()))

    // Dedupe + filter.
    const seen = new Set<string>()
    const recipients: Array<{ user_id: string; email: string; first_name: string }> = []
    for (const u of (freeUsers || [])) {
      const em = String(u.email || '').toLowerCase().trim()
      if (!em || seen.has(em) || unsubSet.has(em)) continue
      seen.add(em)
      recipients.push({
        user_id: String(u.user_id || ''),
        email: em,
        first_name: String(u.first_name || '').trim() || 'there',
      })
    }

    // Ensure every recipient has a preferences row (so their unsub
    // token exists). Bulk-upsert on user_id.
    if (recipients.length) {
      const prefsRows = recipients.map(r => ({ user_id: r.user_id || `email:${r.email}`, email: r.email }))
      await supabase
        .from('user_email_preferences')
        .upsert(prefsRows, { onConflict: 'user_id', ignoreDuplicates: true })
    }

    // Pull tokens back for the recipient set.
    const { data: tokenRows } = await supabase
      .from('user_email_preferences')
      .select('email, unsubscribe_token')
      .in('email', recipients.map(r => r.email))
    const tokenByEmail = new Map<string, string>()
    for (const t of (tokenRows || [])) {
      tokenByEmail.set(String(t.email || '').toLowerCase(), String(t.unsubscribe_token || ''))
    }

    // Send loop — 200ms delay between emails to stay well under
    // Resend's 10 req/s free-tier ceiling. Log every attempt.
    let sent = 0, failed = 0, skipped = 0
    for (const r of recipients) {
      // Skip if already logged for this campaign (double-click safety).
      const { data: existing } = await supabase
        .from('email_send_log')
        .select('id')
        .eq('campaign_key', campaignKey)
        .eq('email', r.email)
        .maybeSingle()
      if (existing?.id) { skipped++; continue }

      const token = tokenByEmail.get(r.email) || 'unknown-token'
      const result = await sendOne(r.email, r.first_name, token)
      await supabase.from('email_send_log').insert({
        campaign_key: campaignKey,
        user_id: r.user_id || null,
        email: r.email,
        subject,
        resend_id: result.id,
        status: result.ok ? 'sent' : 'failed',
        error: result.error,
      })
      if (result.ok) sent++; else failed++
      await new Promise(res => setTimeout(res, 200))
    }

    return new Response(JSON.stringify({
      mode: 'bulk', campaign_key: campaignKey,
      total_recipients: recipients.length, sent, failed, skipped,
    }), {
      status: 200, headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'unknown' }), {
      status: 500, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
