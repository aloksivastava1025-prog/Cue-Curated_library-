// ============================================================
// Cue — R2 upload proxy (S3-compatible, direct fetch)
// ============================================================
// Admin uploads land here; the function signs an AWS Sig V4 PUT
// request against Cloudflare R2 and streams the bytes through.
// Avoids @aws-sdk/client-s3 entirely because it cold-starts slowly
// on Supabase Edge Functions (esm.sh has to pull a huge bundle),
// which was causing 60-second timeouts on 5MB uploads.
// aws4fetch is 4 KB, self-contained, and Cloudflare-friendly.
//
// Env vars required (Supabase → Functions → Secrets):
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_ENDPOINT             (e.g. https://<accountid>.r2.cloudflarestorage.com)
//   R2_BUCKET               (cue-media)
//   R2_PUBLIC_URL           (https://pub-XXXX.r2.dev)
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { AwsClient } from 'https://esm.sh/aws4fetch@1.0.20';
import { verifyClerkJwt, authErrorResponse } from '../_shared/clerk.ts';

// Cap per-file bytes at 25 MB. Anything larger is either an
// accidentally-heavy asset or an abuse attempt.
const MAX_BYTES = 25 * 1024 * 1024;
// Whitelist mime types. R2 will still store whatever we send, but
// gating here means the bucket cannot be turned into a phishing
// host / malware relay via arbitrary Content-Types.
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

const CACHE_CONTROL = 'public, max-age=2592000, immutable';

serve(async (req) => {
  const headers = corsHeaders(req);
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  // AUTH: only signed-in Clerk users can upload. Pre-launch audit
  // flagged the previous "no auth, no size cap, no MIME check"
  // shape as a free R2 filler + phishing-host relay.
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

    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'file required (multipart)' }), {
        status: 400, headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
    if (file.size > MAX_BYTES) {
      return new Response(JSON.stringify({ error: `file too large (${file.size} bytes, max ${MAX_BYTES})` }), {
        status: 413, headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
    const mime = (file.type || '').toLowerCase();
    if (!ALLOWED_MIME.has(mime)) {
      return new Response(JSON.stringify({ error: `mime not allowed: ${mime}` }), {
        status: 415, headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }
    // Strip `..` and absolute paths from prefix. Only allow simple
    // safe path segments (letters, digits, underscore, hyphen).
    const rawPrefix = String(form.get('prefix') || '');
    const prefix = rawPrefix
      .split('/')
      .map((seg) => seg.replace(/[^a-z0-9_-]/gi, ''))
      .filter(Boolean)
      .join('/');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/gi, '');
    // Full UUID (32 hex) instead of 6-char slice — pre-audit key
    // shape was enumerable within a ~16M window.
    const randPart = crypto.randomUUID().replace(/-/g, '');
    const key = `${prefix ? prefix + '/' : ''}${Date.now()}-${randPart}.${ext}`;
    // Log the uploader for post-hoc abuse auditing.
    console.log(JSON.stringify({ evt: 'upload-to-r2', sub: clerkSub, key, size: file.size, mime }));

    const aws = new AwsClient({
      accessKeyId: accessKey,
      secretAccessKey: secret,
      service: 's3',
      region: 'auto',
    });

    // Buffer the file into memory rather than streaming — aws4fetch
    // reads the body to compute the SHA-256 for the Sig V4 signature,
    // which locks a ReadableStream and errors out on the second read
    // ("ReadableStream is locked or disturbed"). ArrayBuffer is
    // re-readable and safe up to Supabase Edge Functions' 256 MB
    // memory ceiling; 20 MB uploads sit comfortably inside that.
    const buf = new Uint8Array(await file.arrayBuffer());
    const putUrl = `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`;
    const putResp = await aws.fetch(putUrl, {
      method: 'PUT',
      body: buf,
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'Cache-Control': CACHE_CONTROL,
      },
    });

    if (!putResp.ok) {
      const t = await putResp.text().catch(() => '');
      console.error('R2 PUT failed', putResp.status, t.slice(0, 200));
      return new Response(JSON.stringify({ error: `R2 PUT ${putResp.status}: ${t.slice(0, 200)}` }), {
        status: 502, headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const url = `${publicUrl.replace(/\/$/, '')}/${key}`;
    const kind = (file.type || '').startsWith('video/') ? 'video' : 'image';

    return new Response(JSON.stringify({ url, kind, key }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('upload-to-r2 error', (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
});
