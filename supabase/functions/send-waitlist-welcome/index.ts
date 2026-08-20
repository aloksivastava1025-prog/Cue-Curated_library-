// ============================================================
// CUE — Waitlist welcome email
// ============================================================
// Fires after a successful waitlist signup on the homepage.
// Non-blocking — if the email fails, the signup still counts.
// Idempotency at the caller: backend.subscribeWaitlist only
// invokes this when the DB insert actually created a new row
// (returns early with alreadyOnList otherwise).
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
))

serve(async (req) => {
  const headers = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers })

  try {
    const body = await req.json().catch(() => ({}))
    const email  = String(body?.email  || '').trim().toLowerCase().slice(0, 320)
    const source = String(body?.source || '').trim().slice(0, 60)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      // Silent no-op if Resend isn't configured yet — don't block
      // the signup UX.
      return new Response(JSON.stringify({ sent: false, reason: 'no-resend-key' }), {
        status: 200, headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0A0A0A;">
        <div style="font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: #0000FF; font-weight: 700; margin-bottom: 12px;">Cue · Waitlist</div>
        <h2 style="margin: 0 0 14px; font-family: Georgia, serif; font-style: italic; font-weight: 400; font-size: 30px; color: #0A0A0A; line-height: 1.15;">
          You're in.
        </h2>
        <p style="font-size: 14.5px; line-height: 1.75; color: #333; margin: 0 0 14px;">
          Every week Cue drops a handful of prompts hand-picked from Awwwards-caliber sites — the kind of interaction where the difference between "AI hero section" and "AI hero section that clients remember" lives.
        </p>
        <p style="font-size: 14.5px; line-height: 1.75; color: #333; margin: 0 0 22px;">
          You'll get the first one Friday. Nothing else. No newsletter series, no upsell drip.
        </p>
        <div style="padding: 14px 18px; background: rgba(204,255,0,0.10); border: 1px solid rgba(204,255,0,0.35); border-radius: 8px; margin: 20px 0;">
          <div style="font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; font-weight: 700; color: #6b8600; margin-bottom: 6px;">Founding perk</div>
          <p style="margin: 0; font-size: 13.5px; color: #333; line-height: 1.6;">
            First 50 members lock $99 lifetime forever — after that it's $249. If you're planning to buy, do it before the counter fills.
            <a href="https://www.cuedesign.space/#/pricing" style="color: #0000FF; font-weight: 500;">See pricing →</a>
          </p>
        </div>
        <p style="margin: 24px 0 4px; font-size: 14px; color: #333;">— Alok, Cue</p>
        <p style="margin: 0; font-size: 11.5px; color: #999;">
          <a href="https://www.cuedesign.space" style="color: #999; text-decoration: none;">cuedesign.space</a> · You signed up from <span style="font-family: Menlo, monospace;">${esc(source || 'homepage')}</span>
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
        to: email,
        reply_to: 'hello@cuedesign.space',
        subject: "You're in — Cue waitlist",
        html,
      }),
    })

    if (!resp.ok) {
      const t = await resp.text()
      return new Response(JSON.stringify({
        sent: false,
        status: resp.status,
        error: t.slice(0, 300),
      }), { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200, headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ sent: false, error: err?.message || 'unknown' }), {
      status: 200, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
