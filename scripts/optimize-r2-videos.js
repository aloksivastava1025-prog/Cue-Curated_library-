// ============================================================
// Cue — R2 video re-optimization
// ============================================================
// Downloads every MP4 in the R2 bucket, remuxes it with
// +faststart and downscales to 720p @ 1.5 Mbps, then uploads
// back to the same key. Result: web-optimized MP4s that begin
// playing after ~500 KB downloaded instead of the full file,
// AND are typically 3-5x smaller.
//
// Usage:
//   node scripts/optimize-r2-videos.js              # dry-run (list only)
//   node scripts/optimize-r2-videos.js --run        # actually re-encode + upload
//   node scripts/optimize-r2-videos.js --run --limit 3   # first 3 only (test)
//   node scripts/optimize-r2-videos.js --run --key cue056/foo.mp4  # single file
//
// Requires: local .env with R2_* creds (same as migrate-to-r2.js),
// and ffmpeg on PATH.
// ============================================================

import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync, writeFileSync, unlinkSync, statSync, existsSync, mkdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { config as loadEnv } from 'dotenv'
import path from 'node:path'

// R2 creds live in .env.local (matches migrate-to-r2.js convention).
// .env is the shared project config, .env.local overrides for
// scripts that need production credentials. Load both — .env.local
// wins on conflicts.
loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

const {
  R2_ACCESS_KEY_ID,
  R2_SECRET_ACCESS_KEY,
  R2_ENDPOINT,
  R2_BUCKET,
} = process.env

if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_ENDPOINT || !R2_BUCKET) {
  console.error('Missing R2_* env vars. Fill .env first.')
  process.exit(1)
}

const args = process.argv.slice(2)
const doRun = args.includes('--run')
const limitIdx = args.indexOf('--limit')
const limit = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : Infinity
const keyIdx = args.indexOf('--key')
const singleKey = keyIdx >= 0 ? args[keyIdx + 1] : null

// Local scratch dir for the in-flight files
const SCRATCH = path.join(process.cwd(), '.tmp', 'r2-optimize')
if (!existsSync(SCRATCH)) mkdirSync(SCRATCH, { recursive: true })

const s3 = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
})

async function listAllVideos() {
  const out = []
  let token
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      ContinuationToken: token,
    }))
    for (const o of res.Contents || []) {
      if (!o.Key) continue
      if (!/\.(mp4|mov|m4v)$/i.test(o.Key)) continue
      out.push({ key: o.Key, size: o.Size || 0 })
    }
    token = res.NextContinuationToken
  } while (token)
  return out
}

async function download(key, dest) {
  const res = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }))
  const chunks = []
  for await (const chunk of res.Body) chunks.push(chunk)
  writeFileSync(dest, Buffer.concat(chunks))
}

function optimize(inPath, outPath) {
  // Tighter than v1 (was 1280w / 1500k). Card thumb renders at
  // 400–500px, modal preview at ~800px — 960w is still 2× the
  // largest display size. 800k bitrate is enough for muted hover
  // clips (no dialog / no fine detail to preserve). Result: files
  // ~40–50 % smaller than v1, so mobile 4G playback starts closer
  // to 2 s than 5 s.
  //
  //   -vf scale=960:-2       cap width at 960, keep aspect
  //   -c:v libx264 -b:v 800k ~0.8 Mbps target
  //   -preset veryfast       fast encode, still good quality
  //   -movflags +faststart   moov atom at file start; progressive play
  //   -c:a copy              keep any audio track as-is
  //   -y                     overwrite output
  const args = [
    '-i', inPath,
    '-vf', 'scale=\'min(960,iw)\':-2',
    '-c:v', 'libx264',
    '-b:v', '800k',
    '-preset', 'veryfast',
    '-movflags', '+faststart',
    '-c:a', 'copy',
    '-y',
    outPath,
  ]
  const res = spawnSync('ffmpeg', args, { stdio: 'pipe' })
  if (res.status !== 0) {
    // Some videos have no audio track; try again without -c:a copy fallback
    const args2 = args.filter((a, i, arr) => a !== '-c:a' && arr[i - 1] !== '-c:a')
    args2.push('-an')
    const res2 = spawnSync('ffmpeg', args2, { stdio: 'pipe' })
    if (res2.status !== 0) {
      throw new Error('ffmpeg failed: ' + res.stderr.toString().slice(-500))
    }
  }
}

async function upload(key, filePath, contentType) {
  const body = readFileSync(filePath)
  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType || 'video/mp4',
    CacheControl: 'public, max-age=2592000, immutable',
    // Custom metadata tag — next run of this script uses it to
    // detect already-optimized files and skip them. Version bumps
    // (v1 → v2) on a settings change so the whole library
    // re-encodes with the new recipe on the next run. v2 = 960w
    // 800k (was 1280w 1500k in v1).
    Metadata: { 'cue-optimized': 'v2' },
  }))
}

async function isOptimized(key) {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }))
    // Only 'v2' tagged files are skipped. Older 'v1' tags are
    // treated as un-optimized so they re-encode with the new
    // (smaller / faster-loading) recipe.
    return head.Metadata?.['cue-optimized'] === 'v2'
  } catch { return false }
}

function fmtMB(bytes) {
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

async function main() {
  console.log('Listing R2 videos…')
  let videos = singleKey
    ? [{ key: singleKey, size: 0 }]
    : await listAllVideos()

  console.log(`Found ${videos.length} video(s) in ${R2_BUCKET}.`)
  if (!doRun) {
    console.log('\nDry-run — showing first 10:\n')
    for (const v of videos.slice(0, 10)) {
      console.log(`  ${v.key}  ${fmtMB(v.size)}`)
    }
    console.log('\nPass --run to actually re-encode + upload.')
    return
  }

  videos = videos.slice(0, limit)
  console.log(`Optimizing ${videos.length}…\n`)

  let doneBytes = 0
  let savedBytes = 0
  let ok = 0
  let fail = 0

  let skipped = 0
  for (const [i, v] of videos.entries()) {
    const label = `[${i + 1}/${videos.length}] ${v.key}`
    // Idempotent skip — if this file was already processed by a
    // prior run, its cue-optimized metadata tag is set. Re-encoding
    // it would just cost time and marginally degrade quality.
    if (await isOptimized(v.key)) {
      skipped++
      console.log(`${label} · already optimized, skip`)
      continue
    }
    const inFile = path.join(SCRATCH, 'in.mp4')
    const outFile = path.join(SCRATCH, 'out.mp4')
    try {
      process.stdout.write(`${label} … downloading `)
      await download(v.key, inFile)
      const beforeBytes = statSync(inFile).size
      process.stdout.write(`(${fmtMB(beforeBytes)}) → encoding `)
      optimize(inFile, outFile)
      const afterBytes = statSync(outFile).size
      process.stdout.write(`(${fmtMB(afterBytes)}) → uploading… `)
      await upload(v.key, outFile, 'video/mp4')
      const saved = beforeBytes - afterBytes
      doneBytes += beforeBytes
      savedBytes += saved
      ok++
      console.log(`✓ saved ${fmtMB(Math.max(0, saved))}`)
    } catch (err) {
      fail++
      console.log(`✗ ${err.message}`)
    } finally {
      try { unlinkSync(inFile) } catch {}
      try { unlinkSync(outFile) } catch {}
    }
  }

  console.log('\n---')
  console.log(`Done: ${ok} ok, ${fail} failed, ${skipped} already optimized (skipped).`)
  console.log(`Total processed: ${fmtMB(doneBytes)}, saved: ${fmtMB(savedBytes)} (${((savedBytes / Math.max(1, doneBytes)) * 100).toFixed(1)}%).`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
