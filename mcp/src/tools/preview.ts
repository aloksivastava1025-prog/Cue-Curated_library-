// Cue MCP — preview_components tool
// Second step of the standard interaction:
//   1. search_components  → names only
//   2. preview_components → thumbnails for the ids the user picked
//   3. get_component      → prompt + code for the chosen one
//
// Kept separate from search_components so the AI can present the
// short name list first without dumping 20 image URLs into chat.

import { supabase } from '../supabase.js'

export const previewComponentsSchema = {
  name: 'preview_components',
  description:
    'Fetch thumbnails (and hover-video URLs) for a specific list of Cue component ids. Call this AFTER search_components has surfaced a name list and the user has asked to see specific ones. Free-tier friendly — no key required for thumbnails.',
  inputSchema: {
    type: 'object',
    required: ['ids'],
    properties: {
      ids: {
        type: 'array',
        items: { type: 'string' },
        description: 'Component ids to preview (e.g. ["cue019","cue034"]). Cap 10 per call.',
        maxItems: 10,
      },
    },
  },
} as const

export async function previewComponents(input: { ids: string[] }) {
  const ids = (input.ids || []).slice(0, 10).map((s) => String(s).trim()).filter(Boolean)
  if (ids.length === 0) throw new Error('ids is required')

  const { data, error } = await supabase
    .from('prompts')
    .select('id, title, category, tier, thumb_src, hover_src')
    .in('id', ids)
    .eq('status', 'published')
  if (error) throw new Error(`Preview failed: ${error.message}`)

  // Preserve the caller's order (so the AI's numbered list matches).
  const byId = new Map<string, any>()
  for (const r of data || []) byId.set(String(r.id), r)
  const rows = ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((r: any) => ({
      id: r.id,
      title: r.title,
      category: r.category || '',
      tier: r.tier === 'premium' ? 'paid' : 'free',
      thumb_url: r.thumb_src,
      preview_url: r.hover_src,
    }))

  return {
    count: rows.length,
    results: rows,
    next_step: 'Render the thumbnails to the user. Ask which one they want to use. Then call get_component(id) to fetch the prompt + React source.',
  }
}
