// Cue MCP — list_categories tool

import { supabase } from '../supabase.js'

export const listCategoriesSchema = {
  name: 'list_categories',
  description:
    'List all Cue component categories with counts. Useful to discover the taxonomy before calling search_components.',
  inputSchema: { type: 'object', properties: {} },
} as const

export async function listCategories() {
  const { data, error } = await supabase
    .from('prompts')
    .select('category')
    .eq('status', 'published')
  if (error) throw new Error(`list_categories failed: ${error.message}`)

  const counts = new Map<string, number>()
  for (const row of data || []) {
    const c = String((row as any).category || '').trim()
    if (!c) continue
    counts.set(c, (counts.get(c) || 0) + 1)
  }
  const categories = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
  return { count: categories.length, categories }
}
