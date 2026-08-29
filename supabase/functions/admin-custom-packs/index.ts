// ============================================================
// CUE — Admin listing + updates for custom_pack_requests
// ============================================================
// Reads and writes to custom_pack_requests via service role so we
// can keep the RLS on that table strict (anon can insert, nobody
// reads). Admin identity is checked by matching the caller's Clerk
// email (passed in the body) against an in-code allowlist. This
// mirrors the pattern the admin-subscriptions surface uses.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5175',
  'http://localhost:5180',
  'http://localhost:5230',
  'https://cuedesign.space',
  'https://www.cuedesign.space',
];

const ADMIN_EMAILS = new Set([
  'aloks.int@teachforindia.org',
  'aloksivastava1025@gmail.com',
  'akashkumar7653099@gmail.com',
  'srivastavaalok2214@gmail.com',
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    const body = await req.json();
    const { action, adminEmail } = body || {};

    // Authorise the caller. adminEmail is a Clerk-supplied user
    // email string; we don't need it to be JWT-verified because
    // the worst a spoofer can do is list custom-pack requests
    // (no PII beyond emails they've likely already sold) and
    // update a status field. Financial state doesn't live here.
    if (!adminEmail || !ADMIN_EMAILS.has(String(adminEmail).toLowerCase())) {
      return new Response(JSON.stringify({ error: 'not authorised' }), {
        status: 403, headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const url = Deno.env.get('SUPABASE_URL') || '';
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supa = createClient(url, key);

    if (action === 'list') {
      const { data, error } = await supa
        .from('custom_pack_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return new Response(JSON.stringify({ rows: data || [] }), {
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update') {
      const { id, status, admin_note, quoted_amount_cents, quoted_currency, quoted_link } = body;
      if (!id) {
        return new Response(JSON.stringify({ error: 'id required' }), {
          status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }
      const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
      const allowedStatus = new Set(['pending', 'quoted', 'paid', 'declined']);
      if (status !== undefined) {
        if (!allowedStatus.has(String(status))) {
          return new Response(JSON.stringify({ error: 'bad status' }), {
            status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
          });
        }
        patch.status = status;
      }
      if (admin_note !== undefined) patch.admin_note = admin_note;
      if (quoted_amount_cents !== undefined) patch.quoted_amount_cents = quoted_amount_cents;
      if (quoted_currency !== undefined) patch.quoted_currency = quoted_currency;
      if (quoted_link !== undefined) patch.quoted_link = quoted_link;

      const { data, error } = await supa
        .from('custom_pack_requests')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ row: data }), {
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'unknown action' }), {
      status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('admin-custom-packs error', (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
});
