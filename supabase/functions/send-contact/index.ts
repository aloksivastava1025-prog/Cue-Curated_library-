import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import nodemailer from "npm:nodemailer";
import { createClient } from "npm:@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { name, email, inquiry_type, custom_inquiry, message } = await req.json();

    // 1. Insert into Supabase table directly via Edge Function
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { error: dbError } = await supabase
        .from('contact_messages')
        .insert([{ name, email, inquiry_type, custom_inquiry, message }]);
        
      if (dbError) {
        console.error("Failed to save to database:", dbError);
      }
    }

    // 2. Send Email via Nodemailer
    const smtpPassword = Deno.env.get("SMTP_PASSWORD");
    if (!smtpPassword) {
      throw new Error("SMTP_PASSWORD is not configured. Please add it via `npx supabase secrets set SMTP_PASSWORD=your_app_password`");
    }

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'akashkumar7653011@gmail.com',
        pass: smtpPassword,
      },
    });

    // HTML-escape every user-supplied field. Without this, an attacker can
    // inject <a href="http://phish.example">reset password</a> into the
    // email body — a phishing surface aimed at whoever reads support inbox.
    const esc = (s: string = "") => String(s).replace(/[&<>"']/g, (c) => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c] as string
    ));

    const displayInquiry = custom_inquiry ? `Other (${esc(custom_inquiry)})` : esc(inquiry_type);

    const htmlContent = `
      <div style="font-family: sans-serif; padding: 20px; max-width: 600px; border: 1px solid #eaeaea; border-radius: 12px;">
        <h2 style="color: #3B82F6;">New Contact Submission</h2>
        <p><strong>Name:</strong> ${esc(name)}</p>
        <p><strong>Email:</strong> ${esc(email)}</p>
        <p><strong>Inquiry Type:</strong> ${displayInquiry}</p>
        <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #eaeaea;">
          <p><strong>Message:</strong></p>
          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; font-size: 14px; line-height: 1.6; color: #374151;">
            ${esc(message).replace(/\n/g, '<br/>')}
          </div>
        </div>
      </div>
    `;

    const info = await transporter.sendMail({
      from: `"Cue Contact" <akashkumar7653011@gmail.com>`,
      to: "cueui.support@gmail.com",
      subject: `Cue Contact: ${displayInquiry} from ${name}`,
      html: htmlContent,
    });

    return new Response(
      JSON.stringify({ success: true, messageId: info.messageId }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error(error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
