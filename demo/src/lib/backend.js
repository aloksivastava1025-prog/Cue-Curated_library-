import { supabase } from './supabase.js'

function toJs(row) {
  return {
    ...row,
    prompt: row.prompt || null, // Will be fetched securely later
    thumbSrc: row.thumb_src,
    hoverSrc: row.hover_src,
  }
}

function toDb(item) {
  const { prompt, content, mode, thumbSrc, hoverSrc, ...rest } = item
  return {
    ...rest,
    thumb_src: thumbSrc,
    hover_src: hoverSrc,
  }
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
    const { data, error } = await supabase
      .from('prompts')
      .upsert(toDb(item))
      .select()
      .single()
    if (error) throw error

    if (item.prompt) {
      const { error: contentError } = await supabase
        .from('prompt_contents')
        .upsert({ prompt_id: item.id, content: item.prompt })
      if (contentError) throw contentError
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
