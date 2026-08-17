#!/usr/bin/env node
/**
 * One-shot recovery:
 *   1. Read the current `cue001` from Supabase (the user's new item that
 *      overwrote the original) + its prompt content.
 *   2. Copy it to a fresh ID (cue017), preserving all fields.
 *   3. Overwrite cue001 with the ORIGINAL data from the partner CSV
 *      (Arc Hand Fan Card Stack) + original content.
 *
 * Safe: reads / writes only the two IDs involved. Idempotent-ish —
 * running twice just re-copies over cue017 with whatever cue001 has now.
 */

import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import Papa from 'papaparse'

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
  const v = String(raw || 'free').trim().toLowerCase()
  return v === 'premium' || v === 'paid' ? 'premium' : 'free'
}

async function req(supaUrl, anonKey, urlPath, opts = {}) {
  const res = await fetch(supaUrl.replace(/\/+$/, '') + urlPath, {
    ...opts,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation',
      ...(opts.headers || {}),
    },
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${text.slice(0, 300)}`)
  try { return JSON.parse(text) } catch { return text }
}

async function main() {
  const env = loadEnv()
  const supaUrl = env.VITE_SUPABASE_URL
  const anonKey = env.VITE_SUPABASE_ANON_KEY
  if (!supaUrl || !anonKey) throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')

  console.log(`Target: ${supaUrl}\n`)

  // --- 1. Fetch current cue001 (user's item that overwrote the original) --
  console.log('1. Fetching current cue001 (user\'s new item)…')
  const currentArr = await req(supaUrl, anonKey, '/rest/v1/prompts?select=*&id=eq.cue001')
  if (!currentArr.length) throw new Error('cue001 not found in DB — nothing to recover')
  const current = currentArr[0]
  console.log(`   Current cue001 title: "${current.title}"`)

  const currentContentArr = await req(supaUrl, anonKey, '/rest/v1/prompt_contents?select=content&prompt_id=eq.cue001')
  const currentContent = currentContentArr[0]?.content || ''
  console.log(`   Content length: ${currentContent.length} chars`)

  // --- 2. Read partner CSV for the ORIGINAL cue001 --------------------------
  console.log('\n2. Loading original cue001 from partner CSV…')
  const promptsCsvPath = fs.existsSync(path.join(os.homedir(), 'Downloads', 'prompts_rows.csv'))
    ? path.join(os.homedir(), 'Downloads', 'prompts_rows.csv')
    : path.join(projectRoot, 'prompts_rows.csv')
  const contentsCsvPath = fs.existsSync(path.join(os.homedir(), 'Downloads', 'prompt_contents_rows.csv'))
    ? path.join(os.homedir(), 'Downloads', 'prompt_contents_rows.csv')
    : path.join(projectRoot, 'prompt_contents_rows.csv')

  const promptsRaw = fs.readFileSync(promptsCsvPath, 'utf-8')
  const contentsRaw = fs.readFileSync(contentsCsvPath, 'utf-8')
  const promptsCsv = Papa.parse(promptsRaw, { header: true, skipEmptyLines: true }).data
  const contentsCsv = Papa.parse(contentsRaw, { header: true, skipEmptyLines: true }).data

  const originalRow = promptsCsv.find((r) => r.id === 'cue001')
  const originalContentRow = contentsCsv.find((r) => r.prompt_id === 'cue001')
  if (!originalRow) throw new Error('cue001 not found in partner CSV')
  console.log(`   Original cue001 title: "${originalRow.title}"`)

  // --- 3. Insert the user's item as cue017 (or next free ID) ----------------
  console.log('\n3. Picking a fresh ID for the user\'s item…')
  const allIds = await req(supaUrl, anonKey, '/rest/v1/prompts?select=id')
  const nums = allIds.map((r) => parseInt(String(r.id).replace(/\D/g, ''), 10)).filter((n) => !Number.isNaN(n))
  const nextN = Math.max(0, ...nums) + 1
  const newId = `cue${String(nextN).padStart(3, '0')}`
  console.log(`   Assigning: ${newId}`)

  // Copy the current cue001 row under the new ID.
  const copyRow = { ...current, id: newId }
  console.log(`\n4. Inserting user's item as ${newId}…`)
  await req(supaUrl, anonKey, `/rest/v1/prompts?on_conflict=id`, {
    method: 'POST',
    body: JSON.stringify([copyRow]),
  })
  if (currentContent) {
    await req(supaUrl, anonKey, `/rest/v1/prompt_contents?on_conflict=prompt_id`, {
      method: 'POST',
      body: JSON.stringify([{ prompt_id: newId, content: currentContent }]),
    })
  }
  console.log(`   ✅ Preserved: ${newId} = "${current.title}"`)

  // --- 4. Overwrite cue001 with the original from partner CSV --------------
  console.log('\n5. Restoring original cue001…')
  const restorePayload = {
    id: 'cue001',
    title: (originalRow.title || '').trim() || '(untitled)',
    category: (originalRow.category || 'general').trim(),
    section: (originalRow.section || originalRow.category || 'general').trim() || 'general',
    tier: normTier(originalRow.tier),
    rail: originalRow.rail && originalRow.rail.trim() ? originalRow.rail.trim() : null,
    brand: (originalRow.brand || 'cue').trim(),
    variant: (originalRow.variant || 'sans').trim(),
    stack: normStack(originalRow.stack),
    thumb_src: originalRow.thumb_src && originalRow.thumb_src.trim() ? originalRow.thumb_src.trim() : null,
    hover_src: originalRow.hover_src && originalRow.hover_src.trim() ? originalRow.hover_src.trim() : null,
    status: (originalRow.status || 'published').trim(),
    created_at: originalRow.created_at && originalRow.created_at.trim() ? originalRow.created_at.trim() : new Date().toISOString(),
    component_type: normComponentType(originalRow.component_type),
  }
  await req(supaUrl, anonKey, `/rest/v1/prompts?on_conflict=id`, {
    method: 'POST',
    body: JSON.stringify([restorePayload]),
  })
  if (originalContentRow?.content) {
    await req(supaUrl, anonKey, `/rest/v1/prompt_contents?on_conflict=prompt_id`, {
      method: 'POST',
      body: JSON.stringify([{ prompt_id: 'cue001', content: originalContentRow.content }]),
    })
  }
  console.log(`   ✅ Restored: cue001 = "${originalRow.title}"`)

  // --- 5. Verify -----------------------------------------------------------
  const finalPrompts = await req(supaUrl, anonKey, '/rest/v1/prompts?select=id,title&order=id.asc')
  const finalContents = await req(supaUrl, anonKey, '/rest/v1/prompt_contents?select=prompt_id')
  console.log(`\n📦 Final state:`)
  console.log(`   prompts:          ${finalPrompts.length}`)
  console.log(`   prompt_contents:  ${finalContents.length}`)
  console.log(`   cue001 title:  "${finalPrompts.find((r) => r.id === 'cue001')?.title}"`)
  console.log(`   ${newId} title:  "${finalPrompts.find((r) => r.id === newId)?.title}"`)
  console.log('\n✅ Done. Reload your app — you should see 17 items now.')
}

main().catch((e) => {
  console.error('\n❌ Restore failed:', e.message)
  console.error(e.stack)
  process.exit(1)
})
