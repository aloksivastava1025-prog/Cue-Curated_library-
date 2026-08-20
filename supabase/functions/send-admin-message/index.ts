// ============================================================
// CUE — Admin → customer message email
// ============================================================
// Fires whenever admin sends a message (either reply on an
// existing feedback thread OR a fresh conversation via
// ComposeToUser). The customer already gets a bell in
// UserInbox, but a real email means they can act on it without
// having to visit the site again.
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
    const toEmail   = String(body?.toEmail || '').trim().toLowerCase().slice(0, 320)
    const messageBody = String(body?.body || '').trim().slice(0, 4000)
    const isNewThread = Boolean(body?.isNewThread)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(toEmail)) {
      return new Response(JSON.stringify({ error: 'Invalid recipient email' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }
    if (!messageBody) {
      return new Response(JSON.stringify({ error: 'Empty body' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const resendKey = Deno.env.get('RESEND_API_KEY')
    if (!resendKey) {
      return new Response(JSON.stringify({ sent: false, reason: 'no-resend-key' }), {
        status: 200, headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const subject = isNewThread
      ? 'Alok — Cue'
      : "Re: your Cue message"
    const introLine = isNewThread
      ? "Hey — a note from the founder at Cue."
      : "Here's my reply to your message on Cue."

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0A0A0A;">
        <div style="font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #0000FF; font-weight: 700; margin-bottom: 12px;">Cue · From Alok</div>
        <p style="font-size: 14.5px; line-height: 1.7; color: #333; margin: 0 0 18px;">
          ${esc(introLine)}
        </p>
        <div style="padding: 16px 20px; background: #f5f5f5; border-radius: 8px; font-size: 14.5px; line-height: 1.7; color: #0A0A0A; white-space: pre-wrap; border-left: 3px solid #0000FF;">${esc(messageBody)}</div>
        <p style="margin: 24px 0 10px; font-size: 13.5px; line-height: 1.7; color: #333;">
          You can reply directly to this email — it lands in my inbox.
          Or open the thread on Cue: <a href="https://www.cuedesign.space" style="color: #0000FF;">cuedesign.space</a>.
        </p>
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
        to: toEmail,
        reply_to: 'hello@cuedesign.space',
        subject,
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
