import { supabase } from './supabase.js'

function toJs(row) {
  return {
    ...row,
    prompt: row.prompt || null, // Will be fetched securely later
    code: row.code || '',
    thumbSrc: row.thumb_src,
    hoverSrc: row.hover_src,
    // Normalize array-shaped columns (jsonb) — Supabase returns them as arrays,
    // but coerce defensively in case a row was inserted with null.
    tags: Array.isArray(row.tags) ? row.tags : [],
    stack: Array.isArray(row.stack) ? row.stack : [],
    description: row.description || '',
    use_case: row.use_case || '',
    component_type: row.component_type || '',
    // DB stores 'premium'; the app uses 'paid' internally. Translate on read.
    tier: row.tier === 'premium' ? 'paid' : (row.tier || 'free'),
  }
}

// Whitelist approach: only send known DB columns. Anything else (client-only
// fields like `link`, `isNew`, `brandStyle`, `mode`, `content`, `prompt`) is
// silently dropped so it can never trigger a "column not found" error.
function toDb(item) {
  const out = {}

  // --- Original schema columns (always send when present) ---------------
  if (item.id)       out.id = item.id
  if (item.title)    out.title = item.title
  if (item.category) out.category = item.category
  // DB check constraint allows only 'free' | 'premium'. The app uses 'paid'
  // internally (via the AI schema + admin form); translate on write.
  out.tier    = item.tier === 'paid' ? 'premium' : (item.tier || 'free')
  out.status  = item.status  || 'published'
  out.section = item.section || item.category || 'general'
  out.brand   = item.brand   || 'cue'
  out.variant = item.variant || 'sans'
  out.stack   = Array.isArray(item.stack) ? item.stack : []
  if (item.thumbSrc) out.thumb_src = item.thumbSrc
  if (item.hoverSrc) out.hover_src = item.hoverSrc
  if (item.rail)     out.rail = item.rail

  // Timestamps — accept either camelCase (from the client) or snake_case.
  const createdAt = item.created_at || item.createdAt
  if (createdAt) out.created_at = createdAt

  // --- New-schema columns (only send when they have data) ---------------
  // If the DB hasn't run the migration yet these are simply omitted so the
  // insert can still succeed. When present the DB stores them.
  if (item.code && item.code.trim())          out.code = item.code
  if (Array.isArray(item.tags) && item.tags.length) out.tags = item.tags
  if (item.description && item.description.trim())  out.description = item.description
  if (item.use_case && item.use_case.trim())        out.use_case = item.use_case
  if (item.component_type === 'section' || item.component_type === 'interaction') {
    out.component_type = item.component_type
  }

  return out
}

// Fallback: same whitelist, but strip the NEW columns entirely. Used when a
// save fails with a "column missing" error on the initial attempt.
function toDbLegacy(item) {
  const out = toDb(item)
  delete out.code
  delete out.tags
  delete out.description
  delete out.use_case
  delete out.component_type
  return out
}

const supabaseAdapter = {
  mode: 'supabase',
  requiresAuth: true,
  
  async list() {
    const { data, error } = await supabase
      .from('prompts')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data || []).map(toJs)
  },
  
  async create(item) {
    const trySave = async (payload) => {
      const r = await supabase.from('prompts').upsert(payload).select().single()
      return r
    }

    let { data, error } = await trySave(toDb(item))

    // If the DB rejects because a new column (code / tags / description /
    // use_case) hasn't been migrated yet, retry with the legacy-only payload.
    if (error) {
      const msg = error.message || ''
      const isMissingCol = /(?:could not find|does not exist|schema cache|not found|unknown column)/i.test(msg)
      if (isMissingCol) {
        // eslint-disable-next-line no-console
        console.warn('[cue] Save failed due to missing column; retrying with legacy payload:', msg)
        const retry = await trySave(toDbLegacy(item))
        data = retry.data
        error = retry.error
      }
    }
    if (error) throw error

    if (item.prompt) {
      const { error: contentError } = await supabase
        .from('prompt_contents')
        .upsert({ prompt_id: item.id, content: item.prompt })
      // A missing prompt_contents table shouldn't kill the item save either.
      if (contentError && !/(?:does not exist|schema cache|not found)/i.test(contentError.message || '')) {
        throw contentError
      }
    }

    return toJs(data)
  },
  
  async getPromptContent(id) {
    const { data, error } = await supabase
      .from('prompt_contents')
      .select('content')
      .eq('prompt_id', id)
      .maybeSingle()
    if (error || !data) return null
    return data.content
  },
  
  async getPurchases() {
    const { data, error } = await supabase
      .from('purchases')
      .select('prompt_id')
    if (error || !data) return []
    return data.map(p => p.prompt_id)
  },
  
  async createCheckoutSession(promptId, customerEmail, customerName) {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { prompt_id: promptId, customerEmail, customerName }
    })
    
    // Attempt to extract the real error message if it exists in the response
    if (error) {
      console.error("Full Edge Function error:", error);
      if (error.context && error.context.json) {
         try {
           const errData = await error.context.json();
           throw new Error(errData.error || error.message);
         } catch(e) {
           throw new Error(error.message);
         }
      }
      throw new Error(error.message);
    }
    
    if (!data.url) throw new Error('No checkout URL returned')
    return data.url
  },
  
  async remove(id) {
    const { error } = await supabase.from('prompts').delete().eq('id', id)
    if (error) throw error
  },
  
  async clear() {
    const { error } = await supabase.from('prompts').delete().neq('id', '')
    if (error) throw error
  },
  
  async uploadMedia(file) {
    const ext = (file.name.split('.').pop() || 'bin').toLowerCase()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage
      .from('cue-media')
      .upload(path, file, { contentType: file.type, cacheControl: '31536000' })
    if (error) throw error
    const { data } = supabase.storage.from('cue-media').getPublicUrl(path)
    return { url: data.publicUrl, kind: file.type.startsWith('video/') ? 'video' : 'image' }
  },
  
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return { user: data.user }
  },
  
  async signOut() { await supabase.auth.signOut() },
  
  async getUser() {
    const { data } = await supabase.auth.getUser()
    return data.user || null
  },
  
  onAuthChange(cb) {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      cb(session?.user || null)
    })
    return () => sub.subscription.unsubscribe()
  },
}

export const backend = supabaseAdapter
export const backendMode = backend.mode
export const isSupabaseConfigured = true // Always true now since we require it
