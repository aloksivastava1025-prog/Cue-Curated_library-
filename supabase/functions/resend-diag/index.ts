// TEMPORARY DIAGNOSTIC — DELETE AFTER CONFIRMING RESEND WORKS
// Directly hits Resend API with the env's RESEND_API_KEY and
// returns the raw response so we can see the exact failure reason.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

serve(async (req) => {
  // Diagnostic endpoint — locked to production origin only. Do not
  // widen; if it stops being needed, undeploy entirely.
  const origin = req.headers.get('origin') || ''
  const allowed = ['https://cuedesign.space', 'https://www.cuedesign.space'].includes(origin)
    ? origin : 'https://cuedesign.space'
  const cors = {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Vary': 'Origin',
  }
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const key = Deno.env.get('RESEND_API_KEY') || ''
  const keyPresent = !!key
  const keyLen = key.length
  const keyPreview = key ? `${key.slice(0, 6)}...${key.slice(-4)}` : null

  if (!key) {
    return new Response(JSON.stringify({
      ok: false, step: 'env', reason: 'RESEND_API_KEY not set in Supabase secrets',
      keyPresent, keyLen,
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
  }

  const body = await req.json().catch(() => ({}))
  const toEmail = String(body?.to || 'aloksivastava1025@gmail.com')

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Cue Diag <hello@cuedesign.space>',
      to: toEmail,
      subject: 'Cue Resend diagnostic',
      html: '<p>If you can read this, Resend is fully wired.</p>',
    }),
  })

  const text = await resp.text()
  return new Response(JSON.stringify({
    ok: resp.ok,
    status: resp.status,
    keyPresent, keyLen, keyPreview,
    resendResponse: text.slice(0, 1000),
  }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } })
})
