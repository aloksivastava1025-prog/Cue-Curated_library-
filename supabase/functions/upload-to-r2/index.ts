// ============================================================
// Cue — R2 upload proxy (S3-compatible)
// ============================================================
// Browsers can't ship R2 API credentials, so admin uploads route
// through this edge function. It receives a multipart file, signs
// an S3-compatible PUT against Cloudflare R2, and returns the
// public URL. Same shape as backend.uploadMedia's old return
// (Supabase getPublicUrl → { url, kind }).
//
// Env vars required (Supabase → Functions → Secrets):
//   R2_ACCESS_KEY_ID
//   R2_SECRET_ACCESS_KEY
//   R2_ENDPOINT             (e.g. https://<accountid>.r2.cloudflarestorage.com)
//   R2_BUCKET               (cue-media)
//   R2_PUBLIC_URL           (https://pub-XXXX.r2.dev)
//
// Callers: any signed-in user (Clerk-authenticated request). Admin
// gating happens in the client — this proxy stays permissive so
// non-admin flows (avatar uploads by regular users) also work.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  S3Client,
  PutObjectCommand,
} from 'https://esm.sh/@aws-sdk/client-s3@3.658.0';

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
    // Optional path prefix — e.g. 'avatars/user-123-'. Falls back to
    // just a timestamped random name in bucket root (matches the old
    // Supabase upload key shape so pre-migration URLs and post-
    // migration URLs are structurally identical).
    const prefix = String(form.get('prefix') || '').replace(/[^a-z0-9/_-]/gi, '');
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/gi, '');
    const randPart = crypto.randomUUID().slice(0, 6);
    const key = `${prefix ? prefix + '/' : ''}${Date.now()}-${randPart}.${ext}`;

    const buf = new Uint8Array(await file.arrayBuffer());

    const client = new S3Client({
      region: 'auto',
      endpoint,
      credentials: { accessKeyId: accessKey, secretAccessKey: secret },
    });

    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buf,
      ContentType: file.type || 'application/octet-stream',
      CacheControl: CACHE_CONTROL,
    }));

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
