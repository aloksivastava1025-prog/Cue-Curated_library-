// ============================================================
// CUE — "Hire me" project brief notifier
// ============================================================
// Fires from the browser right after a row lands in hire_requests.
// Emails the founder so a lead never sits unnoticed.
// ============================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { enforceIpRateLimit } from '../_shared/rateLimit.ts';

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
  from: string; to: string; reply_to?: string; subject: string; html: string;
}) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY not configured");
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Resend ${resp.status}: ${t.slice(0, 300)}`);
  }
  return resp.json();
}

const BUDGET_LABEL: Record<string, string> = {
  'under-500': 'Under $500',
  '500-2000': '$500 — $2,000',
  '2000-5000': '$2,000 — $5,000',
  '5000-15000': '$5,000 — $15,000',
  '15000-plus': '$15,000+',
  'flexible': 'Open / flexible',
};
const TIMELINE_LABEL: Record<string, string> = {
  'rush': 'Rush · 1 week',
  'normal': 'Normal · 2–4 weeks',
  'flexible': 'Flexible',
};
const TYPE_LABEL: Record<string, string> = {
  'landing': 'Landing / single page',
  'saas': 'SaaS product',
  'portfolio': 'Portfolio / personal',
  'app': 'Full app (backend + logic)',
  'other': 'Other',
};

serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  // Rate-limit: 5 briefs per IP per hour. A serious buyer never
  // submits 5+ briefs in an hour; anything above that is a bot
  // trying to spam Alok's inbox + burn Resend quota.
  const limited = await enforceIpRateLimit(req, 'hire-notify', 5, 60 * 60 * 1000, headers);
  if (limited) return limited;

  try {
    const body = await req.json();
    const {
      name = '', contact = '', contactType = 'email',
      projectDesc = '', siteType = '', budget = '', timeline = '',
      message = '', userId = '',
    } = body || {};

    if (!contact || !name) {
      return new Response(JSON.stringify({ error: 'name + contact required' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const adminEmails = [
      'aloksivastava1025@gmail.com',
      'hello@cuedesign.space',
    ];
    const fromAddress = Deno.env.get('RESEND_FROM_EMAIL') || 'Cue <hello@cuedesign.space>';

    const contactLink = contactType === 'x_handle'
      ? `<a href="https://x.com/${esc(contact.replace(/^@/, ''))}">${esc(contact)}</a> (X)`
      : `<a href="mailto:${esc(contact)}">${esc(contact)}</a>`;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; line-height: 1.55;">
        <div style="font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #666;">
          Cue · Project brief
        </div>
        <h2 style="margin: 6px 0 18px; font-weight: 600;">New brief from ${esc(name)}</h2>
        <table style="border-collapse: collapse; font-size: 14px;">
          <tr><td style="color:#666; padding: 4px 12px 4px 0;">Name</td><td>${esc(name)}</td></tr>
          <tr><td style="color:#666; padding: 4px 12px 4px 0;">Contact</td><td>${contactLink}</td></tr>
          <tr><td style="color:#666; padding: 4px 12px 4px 0;">Site type</td><td>${esc(TYPE_LABEL[siteType] || siteType)}</td></tr>
          <tr><td style="color:#666; padding: 4px 12px 4px 0;">Budget</td><td><strong>${esc(BUDGET_LABEL[budget] || budget)}</strong></td></tr>
          <tr><td style="color:#666; padding: 4px 12px 4px 0;">Timeline</td><td>${esc(TIMELINE_LABEL[timeline] || timeline)}</td></tr>
          ${userId ? `<tr><td style="color:#666; padding: 4px 12px 4px 0;">Clerk user</td><td>${esc(userId)}</td></tr>` : ''}
        </table>
        <div style="margin-top: 20px; padding: 12px 14px; background: #f8f8fa; border-radius: 8px; white-space: pre-wrap;">
          <strong style="display:block; margin-bottom:6px; font-size:12px; color:#666; letter-spacing:0.08em; text-transform:uppercase;">What they're building</strong>
          ${esc(projectDesc)}
        </div>
        ${message ? `<div style="margin-top: 12px; padding: 12px 14px; background: #f8f8fa; border-radius: 8px; white-space: pre-wrap;">
          <strong style="display:block; margin-bottom:6px; font-size:12px; color:#666; letter-spacing:0.08em; text-transform:uppercase;">Extra note</strong>
          ${esc(message)}
        </div>` : ''}
        <p style="margin-top: 24px; font-size: 12px; color: #666;">
          Reply directly to reach them, or DM if they gave an X handle. Aim for a response within 48 hrs to stay on your promise.
        </p>
      </div>
    `;

    const replyTo = contactType === 'email' ? contact : undefined;
    for (const to of adminEmails) {
      try {
        await sendViaResend({
          from: fromAddress,
          to,
          reply_to: replyTo,
          subject: `New project brief from ${name}${budget ? ` · ${BUDGET_LABEL[budget] || budget}` : ''}`,
          html,
        });
      } catch (e) {
        console.error('hire-notify send failed for', to, (e as Error).message);
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('hire-notify error', (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
});
