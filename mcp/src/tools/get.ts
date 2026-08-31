// Cue MCP — get_component tool
// Metadata + prompt. Premium prompts are gated behind CUE_API_KEY
// via the mcp-get-component edge function.

import { supabase, CUE_API_ROOT, getCueApiKey } from '../supabase.js'
import { canonicalTags } from '../canonicalize.js'

export const getComponentSchema = {
  name: 'get_component',
  description:
    'Fetch a single Cue component by ID. Returns metadata + prompt text + React source (source requires a Cue+ API key). Free-tier components return the prompt unconditionally.',
  inputSchema: {
    type: 'object',
    required: ['id'],
    properties: {
      id: {
        type: 'string',
        description: 'Cue component ID (e.g. "cue056").',
      },
    },
  },
} as const

export async function getComponent(input: { id: string }) {
  const id = String(input.id || '').trim()
  if (!id) throw new Error('id is required')

  const apiKey = getCueApiKey()
  if (apiKey) {
    // Paid path — edge function verifies key + returns gated fields.
    const res = await fetch(`${CUE_API_ROOT}/functions/v1/mcp-get-component`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ id }),
    })
    if (res.ok) return await res.json()
    // Fall through to public path on 401/403 so free metadata still returns.
  }

  const { data, error } = await supabase
    .from('prompts')
    .select(
      'id, title, description, category, tags, tier, thumb_src, hover_src, code, source_credit',
    )
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()
  if (error) throw new Error(`Fetch failed: ${error.message}`)
  if (!data) throw new Error(`Component not found: ${id}`)

  const isPremium = data.tier === 'premium'
  let prompt: string | null = null
  if (!isPremium) {
    const { data: pc } = await supabase
      .from('prompt_contents')
      .select('prompt')
      .eq('prompt_id', id)
      .maybeSingle()
    prompt = pc?.prompt || null
  }

  return {
    id: data.id,
    title: data.title,
    description: data.description || '',
    category: data.category || '',
    tags: canonicalTags(Array.isArray(data.tags) ? data.tags : []),
    tier: isPremium ? 'paid' : 'free',
    thumb_url: data.thumb_src,
    preview_url: data.hover_src,
    prompt,
    code: isPremium ? null : (data.code || null),
    source_credit: data.source_credit || null,
    locked: isPremium,
    unlock_url: isPremium ? 'https://cuedesign.space/#/pricing' : null,
  }
}
