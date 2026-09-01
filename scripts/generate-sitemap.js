// ============================================================
// Cue — sitemap.xml generator
// ============================================================
// Pulls every published prompt from Supabase and writes a full
// sitemap.xml to public/. Runs at build time (see package.json
// "build" script) so every Vercel deploy picks up the latest set
// of URLs. Hash routes are listed too — Google mostly ignores
// them, but Bing and DuckDuckGo respect them, and they surface in
// Google Search Console's "Discovered" bucket as a signal.
// ============================================================

import { writeFileSync } from 'node:fs'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env' })
loadEnv({ path: '.env.local', override: true })

const SITE = 'https://cuedesign.space'
const OUT_PATH = 'public/sitemap.xml'

// The SPA is hash-routed, so this sitemap uses fragment URLs. Once
// we migrate to BrowserRouter (post-launch), drop the `#` prefix
// below and Google will fully index each per-route surface.
const STATIC_ROUTES = [
  { loc: '/',                changefreq: 'daily',   priority: '1.0' },
  { loc: '/#/pricing',       changefreq: 'weekly',  priority: '0.9' },
  { loc: '/#/contact',       changefreq: 'monthly', priority: '0.5' },
  { loc: '/#/legal/terms',   changefreq: 'yearly',  priority: '0.3' },
  { loc: '/#/legal/privacy', changefreq: 'yearly',  priority: '0.3' },
  { loc: '/#/legal/refund',  changefreq: 'yearly',  priority: '0.3' },
  { loc: '/#/legal/license', changefreq: 'yearly',  priority: '0.3' },
]

async function fetchPromptIds() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    console.warn('sitemap: no Supabase creds, skipping component URLs')
    return []
  }
  try {
    // No status filter — the prompts table doesn't have a status
    // column in this schema. Every row is treated as published.
    const res = await fetch(
      `${url.replace(/\/$/, '')}/rest/v1/prompts?select=id,created_at&order=id`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    )
    if (!res.ok) {
      console.warn(`sitemap: prompts fetch ${res.status}`)
      return []
    }
    return await res.json()
  } catch (err) {
    console.warn('sitemap: fetch failed', err?.message)
    return []
  }
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

async function main() {
  const prompts = await fetchPromptIds()
  console.log(`sitemap: found ${prompts.length} published prompts`)

  const promptEntries = prompts.map((p) => ({
    loc: `/#/prompt/${p.id}`,
    lastmod: p.created_at ? String(p.created_at).slice(0, 10) : undefined,
    changefreq: 'monthly',
    priority: '0.7',
  }))
  const all = [...STATIC_ROUTES, ...promptEntries]

  const body = all.map((r) => {
    const bits = [
      `    <loc>${xmlEscape(SITE + r.loc)}</loc>`,
      r.lastmod ? `    <lastmod>${r.lastmod}</lastmod>` : null,
      `    <changefreq>${r.changefreq}</changefreq>`,
      `    <priority>${r.priority}</priority>`,
    ].filter(Boolean).join('\n')
    return `  <url>\n${bits}\n  </url>`
  }).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Generated at build time by scripts/generate-sitemap.js.
  Static routes + one entry per published prompt.
  Hash-based fragments are respected by Bing / DuckDuckGo; Google
  consolidates them, so migration to BrowserRouter is a follow-up.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`
  writeFileSync(OUT_PATH, xml)
  console.log(`sitemap: wrote ${all.length} URLs to ${OUT_PATH}`)
}

main().catch((err) => { console.error(err); process.exit(1) })
