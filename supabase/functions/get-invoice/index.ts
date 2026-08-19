// ============================================================
// CUE — Fetch Dodo invoice PDF for a payment
// ============================================================
// Public endpoint. Anyone with a valid Dodo payment_id can pull the
// invoice — this is fine because payment IDs are opaque, only the
// buyer sees theirs in the redirect URL, and Dodo already emails the
// invoice unconditionally.
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Vary': 'Origin',
  }
}

serve(async (req) => {
  const headers = corsHeaders(req)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers })
  }

  try {
    // Payment id accepted from body (POST) or ?payment_id= (GET).
    let paymentId: string | null = null
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}))
      paymentId = body?.payment_id || body?.paymentId || null
    } else {
      const url = new URL(req.url)
      paymentId = url.searchParams.get('payment_id') || url.searchParams.get('paymentId')
    }

    if (!paymentId || !/^pay_/.test(paymentId)) {
      return new Response(JSON.stringify({ error: 'Invalid payment_id' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const dodoApiKey = (Deno.env.get('DODO_PAYMENTS_API_KEY') || '').trim()
    if (!dodoApiKey) {
      return new Response(JSON.stringify({ error: 'Server not configured' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const isLive = Deno.env.get('DODO_ENV') === 'live'
    const baseUrl = isLive ? 'https://live.dodopayments.com' : 'https://test.dodopayments.com'

    // Dodo returns the invoice PDF at /invoices/payments/{payment_id}.
    const dodoResp = await fetch(`${baseUrl}/invoices/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${dodoApiKey}` },
    })

    if (!dodoResp.ok) {
      const errText = await dodoResp.text()
      return new Response(JSON.stringify({
        error: 'Invoice not available yet',
        dodo_status: dodoResp.status,
        dodo_body: errText.slice(0, 300),
      }), {
        status: 502,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    // Stream the PDF back with a download-friendly filename.
    const pdf = await dodoResp.arrayBuffer()
    return new Response(pdf, {
      headers: {
        ...headers,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="cue-invoice-${paymentId}.pdf"`,
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
    })
  }
})
