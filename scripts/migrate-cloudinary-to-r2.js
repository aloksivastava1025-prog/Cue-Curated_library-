// ============================================================
// Cue — Cloudinary → R2 video migration
// ============================================================
// Reads every prompt whose hover_src still points at Cloudinary,
// downloads the video, runs it through the same 720p + faststart
// pipeline as optimize-r2-videos.js, uploads to R2, and rewrites
// the prompts.hover_src column to the new R2 URL.
//
// Usage:
//   node scripts/migrate-cloudinary-to-r2.js              # dry-run
//   node scripts/migrate-cloudinary-to-r2.js --run        # do it
//   node scripts/migrate-cloudinary-to-r2.js --run --limit 3   # first 3 only
//   node scripts/migrate-cloudinary-to-r2.js --run --id cue056 # single row
//
// Requires: local .env.local with R2_* + Supabase creds,
// and ffmpeg on PATH.
// ============================================================

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync, writeFileSync, unlinkSync, statSync, existsSync, mkdirSync, createWriteStream } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { config as loadEnv } from 'dotenv'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_ENDPOINT,
  R2_BUCKET,
  R2_PUBLIC_URL,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env

const need = { R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET, R2_PUBLIC_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY }
const missing = Object.entries(need).filter(([, v]) => !v).map(([k]) => k)
if (missing.length) {
  console.error('Missing env: ' + missing.join(', '))
  process.exit(1)
}

const args = process.argv.slice(2)
const doRun = args.includes('--run')
const limitIdx = args.indexOf('--limit')
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity
const idIdx = args.indexOf('--id')
const singleId = idIdx >= 0 ? args[idIdx + 1] : null

const SCRATCH = path.join(process.cwd(), '.tmp', 'r2-migrate')
if (!existsSync(SCRATCH)) mkdirSync(SCRATCH, { recursive: true })

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

// Raw REST calls — avoids the @supabase/supabase-js realtime
// dependency that crashes on Node 20 (no native WebSocket). We
// only need select + update, both plain PostgREST.
const REST = `${SUPABASE_URL.replace(/\/$/, '')}/rest/v1`
const HEADERS = {
  'apikey': SUPABASE_SERVICE_ROLE_KEY,
  'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation',
}

async function listRows() {
  const filter = singleId
    ? `id=eq.${encodeURIComponent(singleId)}`
    : `hover_src=ilike.${encodeURIComponent('%cloudinary%')}`
  const url = `${REST}/prompts?select=id,title,hover_src&${filter}&order=id`
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`list failed ${res.status}: ${await res.text()}`)
  return await res.json()
}

async function downloadHttp(url, dest) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`fetch ${res.status}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

function optimize(inPath, outPath) {
  // Same recipe as optimize-r2-videos.js — 720p cap, 1.5 Mbps, faststart.
  const argsCmd = [
    '-i', inPath,
    '-vf', 'scale=\'min(1280,iw)\':-2',
    '-c:v', 'libx264',
    '-b:v', '1500k',
    '-preset', 'veryfast',
    '-movflags', '+faststart',
    '-c:a', 'copy',
    '-y',
    outPath,
  ]
  const res = spawnSync('ffmpeg', argsCmd, { stdio: 'pipe' })
  if (res.status !== 0) {
    const noAudio = argsCmd.filter((a, i, arr) => a !== '-c:a' && arr[i - 1] !== '-c:a')
    noAudio.push('-an')
    const res2 = spawnSync('ffmpeg', noAudio, { stdio: 'pipe' })
    if (res2.status !== 0) throw new Error('ffmpeg failed: ' + res.stderr.toString().slice(-500))
  }
}

async function uploadR2(key, filePath) {
  const body = readFileSync(filePath)
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: 'video/mp4',
    CacheControl: 'public, max-age=2592000, immutable',
    Metadata: { 'cue-optimized': '1' },
  }))
  return `${R2_PUBLIC_URL.replace(/\/$/, '')}/${key}`
}

async function updateRow(id, newUrl) {
  const url = `${REST}/prompts?id=eq.${encodeURIComponent(id)}`
  const res = await fetch(url, {
    method: 'PATCH',
    headers: HEADERS,
    body: JSON.stringify({ hover_src: newUrl }),
  })
  if (!res.ok) throw new Error(`update failed ${res.status}: ${await res.text()}`)
}

function fmtMB(bytes) { return (bytes / 1024 / 1024).toFixed(2) + ' MB' }

async function main() {
  console.log('Listing Cloudinary-backed prompts…')
  let rows = await listRows()
  console.log(`Found ${rows.length} row(s).`)

  if (!doRun) {
    console.log('\nDry-run — showing first 10:\n')
    for (const r of rows.slice(0, 10)) console.log(`  ${r.id}  ${r.title}`)
    console.log('\nPass --run to actually migrate.')
    return
  }

  rows = rows.slice(0, limit)
  let ok = 0, fail = 0, doneBytes = 0, savedBytes = 0

  for (const [i, r] of rows.entries()) {
    const label = `[${i + 1}/${rows.length}] ${r.id} — ${r.title}`
    const inFile = path.join(SCRATCH, 'in.mp4')
    const outFile = path.join(SCRATCH, 'out.mp4')
    try {
      process.stdout.write(`${label} … download `)
      await downloadHttp(r.hover_src, inFile)
      const beforeBytes = statSync(inFile).size
      process.stdout.write(`(${fmtMB(beforeBytes)}) → encode `)
      optimize(inFile, outFile)
      const afterBytes = statSync(outFile).size
      process.stdout.write(`(${fmtMB(afterBytes)}) → upload `)
      // Key mirrors existing R2 naming convention: <timestamp>-<8char>.mp4
      const stamp = Math.floor(Math.random() * 1e6) + Date.now()
      const rand = Math.random().toString(36).slice(2, 8)
      const key = `${stamp}-${rand}.mp4`
      const newUrl = await uploadR2(key, outFile)
      process.stdout.write('→ db ')
      await updateRow(r.id, newUrl)
      doneBytes += beforeBytes
      savedBytes += Math.max(0, beforeBytes - afterBytes)
      ok++
      console.log(`✓`)
    } catch (err) {
      fail++
      console.log(`✗ ${err.message}`)
    } finally {
      try { unlinkSync(inFile) } catch {}
      try { unlinkSync(outFile) } catch {}
    }
  }

  console.log('\n---')
  console.log(`Done: ${ok} ok, ${fail} failed.`)
  console.log(`Total: ${fmtMB(doneBytes)}, saved: ${fmtMB(savedBytes)} (${((savedBytes / Math.max(1, doneBytes)) * 100).toFixed(1)}%).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
