// ============================================================
// CUE — Contact form → founder inbox + auto-ack
// ============================================================
// Rewritten to use Resend (was Gmail-SMTP via nodemailer). Every
// submission from the /#/contact form ends up in three places:
//   1. `feedback` table row (source='contact-page') — surfaces in
//       AdminInbox alongside other feedback
//   2. Email to founder at hello@cuedesign.space (ImprovMX forwards
//       to their Gmail) — same inbox they'd read a customer email
//       in normally
//   3. Auto-ack to the customer (if they left an email) so they
//       know it landed
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

// HTML-escape helper — prevents phishing-style content injection when
// user's raw name / message renders inside our email HTML template.
const esc = (s: string = "") => String(s).replace(/[&<>"']/g, (c) => (
  { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c] as string
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
    const body = await resp.text();
    throw new Error(`Resend ${resp.status}: ${body.slice(0, 300)}`);
  }
  return await resp.json();
}

serve(async (req) => {
  const headers = corsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const body = await req.json();
    const name    = String(body?.name || "").trim().slice(0, 200);
    const email   = String(body?.email || "").trim().toLowerCase().slice(0, 320);
    const message = String(body?.message || "").trim().slice(0, 4000);
    const source  = String(body?.source || "contact-page").trim().slice(0, 60);

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400, headers: { ...headers, "Content-Type": "application/json" },
      });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format" }), {
        status: 400, headers: { ...headers, "Content-Type": "application/json" },
      });
    }

    // 1. Insert into feedback table so AdminInbox sees the thread.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: fb, error: fbErr } = await supabase
      .from('feedback')
      .insert({
        kind: 'other',
        message: name ? `From: ${name}\n\n${message}` : message,
        email: email || null,
        source,
      })
      .select()
      .single();
    if (fbErr) {
      console.error("feedback insert failed", fbErr.message);
      // Continue — email delivery is more urgent than DB persistence
      // for a live customer. AdminInbox will just miss this one.
    }

    // 2. Notify founder (Resend → hello@cuedesign.space → ImprovMX → Gmail).
    const displayName = name || 'Anonymous';
    const founderNotification = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0A0A0A;">
        <div style="font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #666; margin-bottom: 8px;">New contact submission · Cue</div>
        <h2 style="margin: 0 0 20px; font-family: Georgia, serif; font-style: italic; font-weight: 400; font-size: 24px; color: #0A0A0A;">
          ${esc(displayName)} sent you a message
        </h2>
        <table style="border-collapse: collapse; font-size: 14px; margin-bottom: 20px;">
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">From</td><td style="padding: 4px 0;">${esc(displayName)}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Email</td><td style="padding: 4px 0;">${email ? `<a href="mailto:${esc(email)}" style="color: #0000FF;">${esc(email)}</a>` : '<em>(not provided)</em>'}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #666;">Source</td><td style="padding: 4px 0; font-family: Menlo, monospace; font-size: 12px;">${esc(source)}</td></tr>
          ${fb?.id ? `<tr><td style="padding: 4px 12px 4px 0; color: #666;">Thread</td><td style="padding: 4px 0;"><a href="https://www.cuedesign.space/#/admin/inbox" style="color: #0000FF;">Reply from AdminInbox →</a></td></tr>` : ''}
        </table>
        <div style="padding: 16px 20px; background: #f5f5f5; border-radius: 8px; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${esc(message)}</div>
        ${email ? `<p style="margin-top: 24px; font-size: 12.5px; color: #666;">Reply directly to this email or from AdminInbox — both routes reach ${esc(displayName)}.</p>` : ''}
      </div>
    `;
    // Founder notification — sent directly to admin Gmail rather
    // than hello@cuedesign.space (which is same as From — some
    // ESPs treat that as a loop and silently drop). Configurable
    // via FOUNDER_EMAIL secret; falls back to a known-good admin
    // Gmail if unset so the founder is never fully blind.
    const founderInbox = (Deno.env.get('FOUNDER_EMAIL')
      || 'aloksivastava1025@gmail.com').trim();
    try {
      await sendViaResend({
        from: "Cue Contact <hello@cuedesign.space>",
        to: founderInbox,
        reply_to: email || undefined,
        subject: `Cue contact: ${displayName}`,
        html: founderNotification,
      });
    } catch (e: any) {
      console.error("founder-notification email failed:", e?.message);
      // Non-fatal — the feedback row still exists.
    }

    // 3. Auto-ack the customer if they provided an email.
    if (email) {
      const customerAck = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #0A0A0A;">
          <div style="font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #0000FF; font-weight: 700; margin-bottom: 12px;">Cue</div>
          <h2 style="margin: 0 0 16px; font-family: Georgia, serif; font-style: italic; font-weight: 400; font-size: 28px; color: #0A0A0A;">
            Thanks, ${esc(displayName)}.
          </h2>
          <p style="font-size: 14.5px; line-height: 1.7; color: #333; margin: 0 0 14px;">
            Your message landed. Cue is one-person-run right now, so replies come from me personally — usually within 5 business days.
          </p>
          <p style="font-size: 14.5px; line-height: 1.7; color: #333; margin: 0 0 20px;">
            Here's what you sent, for your records:
          </p>
          <div style="padding: 14px 18px; background: #f5f5f5; border-radius: 8px; font-size: 13px; line-height: 1.6; color: #555; white-space: pre-wrap; border-left: 3px solid #0000FF;">${esc(message)}</div>
          <p style="margin: 24px 0 4px; font-size: 14px; color: #333;">— Alok, Cue</p>
          <p style="margin: 0; font-size: 12px; color: #999;">
            <a href="https://www.cuedesign.space" style="color: #999; text-decoration: none;">cuedesign.space</a>
          </p>
        </div>
      `;
      try {
        await sendViaResend({
          from: "Alok — Cue <hello@cuedesign.space>",
          to: email,
          reply_to: "hello@cuedesign.space",
          subject: "Got your message — Cue",
          html: customerAck,
        });
      } catch (e: any) {
        console.error("customer-ack email failed:", e?.message);
        // Non-fatal.
      }
    }

    return new Response(
      JSON.stringify({ success: true, feedback_id: fb?.id ?? null }),
      { status: 200, headers: { ...headers, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("send-contact error", error?.message);
    return new Response(
      JSON.stringify({ error: error?.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders(req), "Content-Type": "application/json" } },
    );
  }
});
