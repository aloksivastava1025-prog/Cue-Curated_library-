// ============================================================
// CUE — One-click unsubscribe (public endpoint)
// ============================================================
// GET /unsubscribe-email?token=<hex>
//   → flip user_email_preferences.unsubscribed = true
//   → render a small friendly HTML page confirming it
//
// No auth: the token IS the auth (128-bit random, minted per user
// on their first email send). No login required, no CSRF, just
// the raw click from the email footer — exactly what CAN-SPAM /
// GDPR call for.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4"

const SITE_URL = 'https://cuedesign.space'

function renderPage(status: 'ok' | 'invalid' | 'error', email?: string) {
  const title = status === 'ok'      ? 'Unsubscribed.'
              : status === 'invalid' ? 'Link expired or invalid.'
              :                        'Something went wrong.'
  const body  = status === 'ok'
    ? `You won't receive further drop emails from Cue at <b>${email || 'this address'}</b>. Support / questions still work — email <a href="mailto:hello@cuedesign.space" style="color:#0000FF">hello@cuedesign.space</a>.`
    : status === 'invalid'
      ? `This unsubscribe link isn't valid. If you're getting emails you don't want, email <a href="mailto:hello@cuedesign.space" style="color:#0000FF">hello@cuedesign.space</a> and I'll remove you manually.`
      : `Try again in a minute, or email <a href="mailto:hello@cuedesign.space" style="color:#0000FF">hello@cuedesign.space</a>.`
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title} — Cue</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,'Inter',sans-serif;
       background:#0A0A0A;color:#e8e8e8;display:flex;align-items:center;
       justify-content:center;min-height:100vh;padding:24px;}
  .card{max-width:480px;text-align:center;}
  .tag{font-size:11px;letter-spacing:.18em;text-transform:uppercase;
       color:#0000FF;font-weight:700;margin-bottom:14px;}
  h1{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;
     font-weight:400;font-size:38px;margin:0 0 14px;color:#fff;}
  p{font-size:14.5px;line-height:1.65;color:#bbb;margin:0 0 20px;}
  a.home{display:inline-block;margin-top:8px;padding:10px 18px;
         background:#0000FF;color:#fff;text-decoration:none;
         border-radius:8px;font-size:13px;font-weight:600;
         letter-spacing:.02em;}
</style></head><body><div class="card">
  <div class="tag">CUE</div>
  <h1>${title}</h1>
  <p>${body}</p>
  <a class="home" href="${SITE_URL}">Back to cuedesign.space →</a>
</div></body></html>`
}

serve(async (req) => {
  try {
    const url = new URL(req.url)
    const token = String(url.searchParams.get('token') || '').trim()
    const headers = { 'Content-Type': 'text/html; charset=utf-8' }

    if (!token || token === 'test-token-noop') {
      return new Response(renderPage('invalid'), { status: 200, headers })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Find the row by token, flip unsubscribed=true.
    const { data: row, error } = await supabase
      .from('user_email_preferences')
      .select('user_id, email, unsubscribed')
      .eq('unsubscribe_token', token)
      .maybeSingle()

    if (error || !row) {
      return new Response(renderPage('invalid'), { status: 200, headers })
    }

    if (!row.unsubscribed) {
      const { error: updErr } = await supabase
        .from('user_email_preferences')
        .update({
          unsubscribed: true,
          unsubscribed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('unsubscribe_token', token)
      if (updErr) {
        return new Response(renderPage('error'), { status: 200, headers })
      }
    }

    return new Response(renderPage('ok', row.email), { status: 200, headers })
  } catch {
    return new Response(renderPage('error'), {
      status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }
})
