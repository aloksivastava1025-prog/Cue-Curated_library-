// ============================================================
// CUE — Custom Pack request notifier
// ============================================================
// Fires from the browser right after a row is inserted into
// custom_pack_requests. Sends a single email to the founder so
// they know a new pack request is waiting for a quote. No storage
// side-effects here — the row is already saved, we're only
// notifying.
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

const esc = (s: string = "") => String(s).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
));

async function sendViaResend(payload: {
  from: string;
  to: string;
  reply_to?: string;
  subject: string;
  html: string;
}) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY not configured");
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Resend ${resp.status}: ${t.slice(0, 300)}`);
  }
  return resp.json();
}

serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    const body = await req.json();
    const {
      email = '',
      name = '',
      componentIds = [],
      message = '',
      userId = '',
    } = body || {};

    if (!email) {
      return new Response(JSON.stringify({ error: 'email required' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    // Admin destinations. Kept in code (not env) so any of these
    // can be swapped out in a redeploy without touching secrets.
    const adminEmails = [
      'aloksivastava1025@gmail.com',
      'hello@cuedesign.space',
    ];

    const fromAddress = Deno.env.get('RESEND_FROM_EMAIL') || 'Cue <hello@cuedesign.space>';
    const ids: string[] = Array.isArray(componentIds) ? componentIds : [];

    // Fetch the picked components' metadata (title + thumb) so the
    // email shows visual context, not just opaque `cue056` ids.
    // Uses service role because RLS may hide unpublished rows —
    // an admin email that references a real id should always be
    // resolvable.
    let pickedRows: Array<{ id: string; title?: string; thumb_src?: string }> = [];
    if (ids.length > 0) {
      try {
        const supaUrl = Deno.env.get('SUPABASE_URL') || '';
        const svcKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
        const supa = createClient(supaUrl, svcKey);
        const { data } = await supa
          .from('prompts')
          .select('id, title, thumb_src')
          .in('id', ids);
        pickedRows = (data as typeof pickedRows) || [];
      } catch (e) {
        console.warn('prompt lookup for notify failed', (e as Error).message);
      }
    }
    // Preserve caller-supplied order even after the SQL round trip.
    const byId = new Map(pickedRows.map((r) => [r.id, r] as const));
    const orderedPicks = ids.map((id) => byId.get(id) || { id, title: '', thumb_src: '' });

    // Chunk into rows of 3 columns each so the email renders sanely
    // in every client (Gmail's max width is friendly at ~600px).
    const rowsHtml: string[] = [];
    for (let i = 0; i < orderedPicks.length; i += 3) {
      const chunk = orderedPicks.slice(i, i + 3);
      const cells = chunk.map((r) => `
        <td style="width: 160px; padding: 6px; vertical-align: top; text-align: left;">
          ${r.thumb_src ? `<img src="${esc(r.thumb_src)}" alt="${esc(r.title || r.id)}" width="160" style="width:160px; height:100px; object-fit: cover; display: block; border-radius: 6px; border: 1px solid #e4e4e7;">` : `<div style="width:160px; height:100px; background:#e4e4e7; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#71717a; font-size:11px;">${esc(r.id)}</div>`}
          <div style="margin-top: 6px; font-size: 12px; font-weight: 500; line-height: 1.35;">${esc(r.title || r.id)}</div>
          <div style="font-size: 10px; color: #71717a;">${esc(r.id)}</div>
        </td>
      `).join('');
      rowsHtml.push(`<tr>${cells}</tr>`);
    }
    const idList = orderedPicks.length > 0
      ? `<table role="presentation" cellspacing="0" cellpadding="0" style="margin-top: 8px; border-collapse: collapse;">${rowsHtml.join('')}</table>`
      : '<em>none listed</em>';

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; line-height: 1.55;">
        <div style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #666;">
          Cue · Custom pack request
        </div>
        <h2 style="margin: 6px 0 18px; font-weight: 600;">New request from ${esc(name || email)}</h2>
        <table style="border-collapse: collapse; font-size: 14px;">
          <tr><td style="color:#666; padding: 4px 12px 4px 0;">Email</td><td>${esc(email)}</td></tr>
          <tr><td style="color:#666; padding: 4px 12px 4px 0;">Name</td><td>${esc(name || '—')}</td></tr>
          <tr><td style="color:#666; padding: 4px 12px 4px 0;">Clerk user</td><td>${esc(userId || '—')}</td></tr>
          <tr><td style="color:#666; padding: 4px 12px 4px 0; vertical-align: top;">Picked (${ids.length})</td><td>${idList}</td></tr>
        </table>
        ${message ? `<div style="margin-top: 20px; padding: 12px 14px; background: #f8f8fa; border-radius: 8px; white-space: pre-wrap;">${esc(message)}</div>` : ''}
        <p style="margin-top: 24px; font-size: 12px; color: #666;">
          Reply directly to this email to reach the user (their email is set as reply-to). Or open the admin panel to update status:
          <br>
          <a href="https://cuedesign.space/#/admin/custom-packs">cuedesign.space/#/admin/custom-packs</a>
        </p>
        <p style="margin-top: 12px; font-size: 12px; color: #666;">
          Note: users are told the fastest path is DMing @alok619308 on X. If they DM before you reply, quote there and activate from there.
        </p>
      </div>
    `;

    for (const to of adminEmails) {
      try {
        await sendViaResend({
          from: fromAddress,
          to,
          reply_to: email,
          subject: `New custom pack request from ${name || email}`,
          html,
        });
      } catch (e) {
        console.error('notify send failed for', to, (e as Error).message);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('custom-pack-notify error', (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
});
