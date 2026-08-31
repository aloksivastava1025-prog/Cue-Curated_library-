// Cue MCP — list_tags tool

import { supabase } from '../supabase.js'
import { canonicalTag } from '../canonicalize.js'

export const listTagsSchema = {
  name: 'list_tags',
  description:
    'List all Cue component tags (canonicalised) with counts. Feed a tag into search_components({ tags: [...] }) to filter.',
  inputSchema: { type: 'object', properties: {} },
} as const

export async function listTags() {
  const { data, error } = await supabase
    .from('prompts')
    .select('tags')
    .eq('status', 'published')
  if (error) throw new Error(`list_tags failed: ${error.message}`)

  const counts = new Map<string, number>()
  for (const row of data || []) {
    const raws = Array.isArray((row as any).tags) ? (row as any).tags : []
    const seen = new Set<string>()
    for (const raw of raws) {
      const t = canonicalTag(raw)
      if (!t || seen.has(t)) continue
      seen.add(t)
      counts.set(t, (counts.get(t) || 0) + 1)
    }
  }
  const tags = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
  return { count: tags.length, tags }
}
