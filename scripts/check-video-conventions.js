#!/usr/bin/env node
/* eslint-disable no-console */
// ============================================================
// Cue — video-usage guardrails
// ============================================================
// One incident of 213 GB / 5 GB cached egress is enough. This script
// greps the codebase for the patterns that caused it and fails the
// build if any of them come back. Runs on every commit via
// `npm run predeploy` and can be wired into a pre-push git hook or
// CI step.
//
// Add or remove rules by editing FORBIDDEN below. Each rule takes a
// regex, a human explanation, and a whitelist of file paths that are
// legitimately allowed to violate (e.g. the admin thumbnail-frame
// extractor which needs preload="auto" to grab a frame — user
// triggered only).
// ============================================================

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const SRC_DIR = join(ROOT, 'src')

const FORBIDDEN = [
  {
    // preload="auto" downloads the full clip on mount. Only allowed
    // when the <video> element is *guaranteed* to mount only after
    // a real user interaction (hover / click). Any file that fires
    // <video preload="auto"> from a mount that runs on scroll or
    // page-load is a regression.
    pattern: /preload=["']auto["']/,
    reason: 'preload="auto" downloads the entire clip on mount — only allowed on user-intent gated video elements',
    // Files below have been reviewed and mount their <video> only
    // after real user intent (hover, click). If you add another
    // component here, verify the mount path is gated too.
    allowedFiles: [
      // EditorialCard — mounts only after everHovered (first real hover)
      'src/components/EditorialCard.jsx',
      // FeaturedRail — mounts only after everActive (first hover/centered)
      'src/components/FeaturedRail.jsx',
      // CategoryRail — same shape as FeaturedRail: <video> element
      // renders only when hover is true, so preload="auto" fires on
      // user intent, never on cold mount.
      'src/components/CategoryRail.jsx',
      // Admin — frame extraction, only fires on user-triggered upload
      // or window.confirm backfill
      'src/pages/Admin.jsx',
    ],
  },
  {
    // Force-calling v.load() inside a hover / inView effect re-downloads
    // the file even when the browser already has it buffered. Was the
    // #2 cause of the incident.
    pattern: /\.load\(\)/,
    reason: 'video.load() force-refetches — trust the buffer instead',
    allowedFiles: [
      // Admin frame extractor sets video.src imperatively; browser
      // may need load() to kick off. Same file that gates on user
      // upload / confirm.
      'src/pages/Admin.jsx',
      // Modal calls v.load() only when the user opens a new modal
      // (item?.id change). Refetches metadata only because preload
      // is "metadata" — cheap and user-intent gated by the click.
      'src/components/Modal.jsx',
    ],
    // Only alarm when the .load() is on something that looks like a
    // <video> ref. Grep is broad, so filter by nearby context.
    contextFilter: (line, before, after) => {
      const window = (before + '\n' + line + '\n' + after).toLowerCase()
      return /video|videoref|vref/.test(window)
    },
  },
  {
    // autoPlay attribute on a video that isn't behind an intent gate
    // (hover state, click). We can't tell from a grep whether it's
    // gated — so we default to *warn* and expect the reviewer to
    // verify. Failed only if `viewport` also appears nearby (auto-
    // play on scroll is the exact incident).
    pattern: /autoPlay/,
    reason: 'autoPlay without intent-gating triggers scroll-play downloads',
    warnOnly: true,
    contextFilter: (line, before, after) => {
      const window = (before + '\n' + line + '\n' + after).toLowerCase()
      return /viewport|inview|intersect/.test(window)
    },
    allowedFiles: [],
  },
]

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith('.') || entry === 'node_modules' || entry === 'dist') continue
    const p = join(dir, entry)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, out)
    else if (/\.(js|jsx|ts|tsx)$/.test(entry)) out.push(p)
  }
  return out
}

function check() {
  const files = walk(SRC_DIR)
  const errors = []
  const warnings = []
  for (const abs of files) {
    const rel = relative(ROOT, abs).replaceAll('\\', '/')
    const content = readFileSync(abs, 'utf8')
    const lines = content.split('\n')
    for (const rule of FORBIDDEN) {
      if (rule.allowedFiles.includes(rel)) continue
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (!rule.pattern.test(line)) continue
        // Skip if this looks like a comment
        if (/^\s*(\/\/|\*|#)/.test(line)) continue
        if (rule.contextFilter) {
          const before = lines.slice(Math.max(0, i - 4), i).join('\n')
          const after = lines.slice(i + 1, i + 5).join('\n')
          if (!rule.contextFilter(line, before, after)) continue
        }
        const record = { file: rel, line: i + 1, snippet: line.trim().slice(0, 120), reason: rule.reason }
        if (rule.warnOnly) warnings.push(record)
        else errors.push(record)
      }
    }
  }
  return { errors, warnings }
}

const { errors, warnings } = check()

if (warnings.length > 0) {
  console.log('\n⚠️  Video convention warnings:')
  for (const w of warnings) {
    console.log(`  ${w.file}:${w.line}  ${w.reason}`)
    console.log(`    > ${w.snippet}`)
  }
}

if (errors.length > 0) {
  console.error('\n❌  Video convention violations — the 213 GB egress bug pattern is back:\n')
  for (const e of errors) {
    console.error(`  ${e.file}:${e.line}  ${e.reason}`)
    console.error(`    > ${e.snippet}`)
  }
  console.error(`\n${errors.length} violation(s). If this is intentional, add the file to allowedFiles in scripts/check-video-conventions.js after review.\n`)
  process.exit(1)
}

console.log(`✅  Video conventions clean — ${warnings.length} warning(s), 0 errors.`)
