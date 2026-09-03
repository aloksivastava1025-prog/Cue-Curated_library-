// Cue MCP — search_components tool
// Names-only browse. Returns id + title + tier + has_code so the
// AI can present a short list without dumping 20 thumbnails into
// chat. Use preview_components({ids}) after the user picks which
// ones they want to see, then get_component(id) to fetch prompt
// + code for the chosen one.

import { supabase } from '../supabase.js'
import { canonicalTag, canonicalTags } from '../canonicalize.js'

export const searchComponentsSchema = {
  name: 'search_components',
  description:
    'Search Cue components by keyword, tag, category, or tier. Returns a LIGHT list (id + title + category + tier + has_code) — NOT thumbnails. Present these names to the user first, ask which ones they want to preview, then call preview_components({ids}) to fetch thumbnails, then get_component(id) to fetch the actual prompt + React source.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Free-text keyword search across title + description.',
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Filter by one or more tags (e.g. ["hero","3d & webgl"]).',
      },
      category: {
        type: 'string',
        description: 'Filter by category name.',
      },
      tier: {
        type: 'string',
        enum: ['free', 'paid', 'all'],
        description: 'Filter by tier. "all" is default.',
        default: 'all',
      },
      limit: {
        type: 'number',
        description: 'Max results (default 20, max 50).',
        default: 20,
        maximum: 50,
      },
    },
  },
} as const

export async function searchComponents(input: {
  query?: string
  tags?: string[]
  category?: string
  tier?: 'free' | 'paid' | 'all'
  limit?: number
}) {
  const limit = Math.min(Math.max(input.limit ?? 20, 1), 50)
  let q = supabase
    .from('prompts')
    .select(
      'id, title, description, category, tags, tier, thumb_src, hover_src, code, view_count, like_count',
    )
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (input.query) {
    const s = String(input.query).slice(0, 100)
    q = q.or(`title.ilike.%${s}%,description.ilike.%${s}%`)
  }
  if (input.category) {
    q = q.ilike('category', `%${input.category}%`)
  }
  if (input.tier && input.tier !== 'all') {
    // DB stores 'premium'; caller uses 'paid'
    q = q.eq('tier', input.tier === 'paid' ? 'premium' : 'free')
  }
  const { data, error } = await q
  if (error) throw new Error(`Search failed: ${error.message}`)

  // Lightweight response — id + title + tags + tier + has_code.
  // NO thumb_url / preview_url here: those come from
  // preview_components({ids}) once the user has picked. Keeping
  // this payload small so the chat doesn't drown in URLs.
  let rows = (data || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    category: r.category || '',
    tags: canonicalTags(Array.isArray(r.tags) ? r.tags : []),
    tier: r.tier === 'premium' ? 'paid' : 'free',
    has_code: !!(r.code && String(r.code).trim()),
  }))

  // Client-side tag intersect
  if (Array.isArray(input.tags) && input.tags.length > 0) {
    const wanted = new Set(input.tags.map((t) => canonicalTag(t)))
    rows = rows.filter((r) => r.tags.some((t) => wanted.has(t)))
  }

  return {
    count: rows.length,
    results: rows,
    // Hint the AI wraps into a helpful ask, so the client always
    // stages the interaction the same way: names -> ask -> preview.
    next_step: `Show these ${rows.length} names to the user. Ask which ones they want to preview. Then call preview_components({ids: [...]}) with the chosen ids to fetch thumbnails.`,
  }
}
