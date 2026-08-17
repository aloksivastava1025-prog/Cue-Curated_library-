#!/usr/bin/env node
/**
 * CUE — Import partner CSV export into the NEW Supabase project.
 *
 * Reads two CSVs from ~/Downloads:
 *   - prompts_rows.csv          (16 items metadata)
 *   - prompt_contents_rows.csv  (per-item prompt text)
 *
 * Normalizes:
 *   - component_type: 'sections'/'interactions'  → 'section'/'interaction'
 *   - stack: JSON-string array  → real array
 *   - Drops fields that don't exist on the current schema (rail, brand,
 *     variant, price — kept only if the DB has them; extras ignored)
 *
 * Reads target Supabase URL + anon key from .env (must have run
 * supabase-full-setup.sql on that project first).
 *
 * Safe to re-run: uses upsert on `id`.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'

// ---------- helpers ---------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

function loadEnv() {
  const raw = fs.readFileSync(path.join(projectRoot, '.env'), 'utf-8')
  const out = {}
  for (const line of raw.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq < 0) continue
    out[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
  }
  return out
}

function csvPath(name) {
  // Prefer files in ~/Downloads (where partner sent them). Falls back to
  // project root if the user copied the files there.
  const downloads = path.join(os.homedir(), 'Downloads', name)
  const local = path.join(projectRoot, name)
  if (fs.existsSync(downloads)) return downloads
  if (fs.existsSync(local)) return local
  throw new Error(`CSV not found: ${name} (looked in ~/Downloads and project root)`)
}

function parseCsvFile(p) {
  const text = fs.readFileSync(p, 'utf-8')
  const { data, errors } = Papa.parse(text, { header: true, skipEmptyLines: true })
  if (errors && errors.length) {
    console.warn(`⚠ CSV parse warnings for ${path.basename(p)}:`)
    for (const e of errors.slice(0, 3)) console.warn('  ', e.message)
  }
  return data
}

function normStack(raw) {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : [] } catch { return [] }
}

function normComponentType(raw) {
  if (!raw) return null
  const v = String(raw).trim().toLowerCase().replace(/s$/, '')
  return v === 'section' || v === 'interaction' ? v : null
}

function normTier(raw) {
  // App uses 'free' | 'paid'; DB constraint is 'free' | 'premium'.
  // Store what the DB accepts.
  const v = String(raw || 'free').trim().toLowerCase()
  return v === 'premium' || v === 'paid' ? 'premium' : 'free'
}

async function supaFetch(supaUrl, anonKey, urlPath, opts = {}) {
  const url = supaUrl.replace(/\/+$/, '') + urlPath
  const headers = {
    'apikey': anonKey,
    'Authorization': `Bearer ${anonKey}`,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=representation',
    ...(opts.headers || {}),
  }
  const res = await fetch(url, { ...opts, headers })
  const bodyText = await res.text()
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText} — ${bodyText.slice(0, 300)}`)
  }
  try { return JSON.parse(bodyText) } catch { return bodyText }
}

// ---------- main ------------------------------------------------------------
async function main() {
  const env = loadEnv()
  const supaUrl = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY
  if (!supaUrl || !anonKey) {
    console.error('❌ VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing in .env')
    process.exit(1)
  }

  console.log(`Target: ${supaUrl}`)

  // --- Load and normalize prompts.csv ---------------------------------------
  const promptsCsv = parseCsvFile(csvPath('prompts_rows.csv'))
  console.log(`Loaded ${promptsCsv.length} prompt rows from CSV`)

  const promptsPayload = promptsCsv
    .filter((r) => r.id && r.id.trim())
    .map((r) => ({
      id: r.id.trim(),
      title: (r.title || '').trim() || '(untitled)',
      category: (r.category || 'general').trim(),
      section: (r.section || r.category || 'general').trim() || 'general',
      tier: normTier(r.tier),
      rail: r.rail && r.rail.trim() ? r.rail.trim() : null,
      brand: (r.brand || 'cue').trim(),
      variant: (r.variant || 'sans').trim(),
      stack: normStack(r.stack),
      thumb_src: r.thumb_src && r.thumb_src.trim() ? r.thumb_src.trim() : null,
      hover_src: r.hover_src && r.hover_src.trim() ? r.hover_src.trim() : null,
      status: (r.status || 'published').trim(),
      created_at: r.created_at && r.created_at.trim() ? r.created_at.trim() : new Date().toISOString(),
      component_type: normComponentType(r.component_type),
      // New-schema columns default empty — user can enrich later via AI autofill.
    }))

  // --- Load prompt_contents.csv ---------------------------------------------
  let contentsPayload = []
  try {
    const contentsCsv = parseCsvFile(csvPath('prompt_contents_rows.csv'))
    console.log(`Loaded ${contentsCsv.length} prompt_content rows from CSV`)
    contentsPayload = contentsCsv
      .filter((r) => r.prompt_id && r.prompt_id.trim())
      .map((r) => ({
        prompt_id: r.prompt_id.trim(),
        content: r.content || '',
      }))
  } catch (e) {
    console.warn('⚠ prompt_contents_rows.csv not found — skipping content import')
  }

  // --- Upsert prompts -------------------------------------------------------
  console.log(`\nUpserting ${promptsPayload.length} rows into public.prompts…`)
  const promptsRes = await supaFetch(supaUrl, anonKey, '/rest/v1/prompts?on_conflict=id', {
    method: 'POST',
    body: JSON.stringify(promptsPayload),
  })
  console.log(`✅ prompts: ${Array.isArray(promptsRes) ? promptsRes.length : '?'} rows upserted`)

  // --- Upsert prompt_contents ----------------------------------------------
  if (contentsPayload.length) {
    console.log(`\nUpserting ${contentsPayload.length} rows into public.prompt_contents…`)
    // Batch just in case content is large (200KB+ per item).
    const chunk = 8
    let ok = 0
    for (let i = 0; i < contentsPayload.length; i += chunk) {
      const slice = contentsPayload.slice(i, i + chunk)
      const res = await supaFetch(supaUrl, anonKey, '/rest/v1/prompt_contents?on_conflict=prompt_id', {
        method: 'POST',
        body: JSON.stringify(slice),
      })
      ok += Array.isArray(res) ? res.length : 0
      process.stdout.write(`  batch ${Math.min(i + chunk, contentsPayload.length)}/${contentsPayload.length}\r`)
    }
    console.log(`\n✅ prompt_contents: ${ok} rows upserted`)
  }

  // --- Verify --------------------------------------------------------------
  const verifyPrompts = await supaFetch(
    supaUrl, anonKey,
    '/rest/v1/prompts?select=id,title&order=created_at.desc',
    { method: 'GET' },
  )
  const verifyContents = await supaFetch(
    supaUrl, anonKey,
    '/rest/v1/prompt_contents?select=prompt_id',
    { method: 'GET' },
  )
  console.log(`\n📦 Final counts:`)
  console.log(`   prompts:          ${verifyPrompts.length}`)
  console.log(`   prompt_contents:  ${verifyContents.length}`)
  console.log('\nDone. Reload your app — you should see all items on the homepage.')
}

main().catch((e) => {
  console.error('\n❌ Import failed:', e.message)
  console.error(e.stack)
  process.exit(1)
})
