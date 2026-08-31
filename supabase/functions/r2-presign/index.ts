// ============================================================
// Cue — R2 presigned PUT URL generator
// ============================================================
// Browser calls this to get a short-lived (5 min) signed URL. It
// then PUTs the file DIRECTLY to Cloudflare R2, bypassing this
// edge function entirely. Result: no more edge-fn buffer of the
// whole file, no more Supabase egress cost, no more 60s timeouts
// on 15+ MB videos.
//
// Flow:
//   1. Browser POST { filename, contentType, size, prefix } →
//   2. Edge fn verifies Clerk JWT, validates MIME + size, builds
//      a full R2 key, signs a PUT URL good for 5 minutes.
//   3. Returns { putUrl, publicUrl, key, contentType }.
//   4. Browser does PUT putUrl (Content-Type: <same>) with the file.
//   5. Browser stores publicUrl in Cue's DB via the normal admin flow.
//
// Env vars required (Supabase → Functions → Secrets):
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_ENDPOINT             (https://<accountid>.r2.cloudflarestorage.com)
//   R2_BUCKET               (cue-media)
//   R2_PUBLIC_URL           (https://pub-XXXX.r2.dev)
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';
import { verifyClerkJwt, authErrorResponse } from '../_shared/clerk.ts';

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB — same as upload-to-r2
const ALLOWED_MIME = new Set<string>([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic',
  'video/mp4', 'video/webm', 'video/quicktime',
]);

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
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  // AUTH: only signed-in Clerk users can request a signed URL.
  let clerkSub = '';
  try {
    const claims = await verifyClerkJwt(req);
    clerkSub = claims.sub;
  } catch (err) {
    return authErrorResponse(err, headers);
  }

  try {
    const accessKey = Deno.env.get('R2_ACCESS_KEY_ID');
    const secret = Deno.env.get('R2_SECRET_ACCESS_KEY');
    const endpoint = Deno.env.get('R2_ENDPOINT');
    const bucket = Deno.env.get('R2_BUCKET') || 'cue-media';
    const publicUrl = Deno.env.get('R2_PUBLIC_URL');
    if (!accessKey || !secret || !endpoint || !publicUrl) {
      return new Response(JSON.stringify({ error: 'R2 not configured' }), {
        status: 500, headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const filename = String(body?.filename || '').slice(0, 200);
    const contentType = String(body?.contentType || '').toLowerCase();
    const size = Number(body?.size || 0);
    const rawPrefix = String(body?.prefix || '');

    if (!filename) {
      return new Response(JSON.stringify({ error: 'filename required' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
    if (!Number.isFinite(size) || size <= 0 || size > MAX_BYTES) {
      return new Response(JSON.stringify({ error: `size out of range (max ${MAX_BYTES})` }), {
        status: 413, headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
    if (!ALLOWED_MIME.has(contentType)) {
      return new Response(JSON.stringify({ error: `mime not allowed: ${contentType}` }), {
        status: 415, headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    // Sanitise prefix — only simple path segments.
    const prefix = rawPrefix
      .split('/')
      .map((seg) => seg.replace(/[^a-z0-9_-]/gi, ''))
      .filter(Boolean)
      .join('/');
    const ext = (filename.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/gi, '');
    const randPart = crypto.randomUUID().replace(/-/g, '');
    const key = `${prefix ? prefix + '/' : ''}${Date.now()}-${randPart}.${ext}`;

    console.log(JSON.stringify({ evt: 'r2-presign', sub: clerkSub, key, size, mime: contentType }));

    const aws = new AwsClient({
      accessKeyId: accessKey,
      secretAccessKey: secret,
      service: 's3',
      region: 'auto',
    });

    const putEndpoint = `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
    // aws4fetch's `sign()` mode: 'raw' returns a fully-signed Request
    // object we can extract the URL from. Query-string signing (X-Amz-*)
    // makes the URL usable directly from the browser as a PUT target.
    // 300s (5 min) is plenty for even a slow 25 MB upload.
    const signed = await aws.sign(
      new Request(putEndpoint, {
        method: 'PUT',
        headers: { 'Content-Type': contentType },
      }),
      { aws: { signQuery: true }, expiresIn: 300 },
    );

    const publicKeyUrl = `${publicUrl.replace(/\/$/, '')}/${key}`;

    return new Response(JSON.stringify({
      putUrl: signed.url,
      publicUrl: publicKeyUrl,
      key,
      contentType,
    }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('r2-presign error', (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
});
