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
  
  async create(item, opts = {}) {
    // ------------------------------------------------------------------
    // Bulletproof ID assignment. Before saving a NEW item, query the DB
    // for the max existing cueNNN id and pick the next one. This makes
    // the save immune to stale front-end state (form.id set at mount
    // before the initial fetch completed). Editing an existing row
    // keeps its id unchanged.
    // ------------------------------------------------------------------
    const isUpdate = opts.isUpdate === true
    let payloadItem = item
    if (!isUpdate) {
      try {
        const { data: idRows } = await supabase.from('prompts').select('id')
        const nums = (idRows || [])
          .map((r) => parseInt(String(r.id).replace(/\D/g, ''), 10))
          .filter((n) => !Number.isNaN(n))
        const next = (nums.length ? Math.max(...nums) : 0) + 1
        payloadItem = { ...item, id: `cue${String(next).padStart(3, '0')}` }
      } catch (e) {
        // If we can't query, fall through with whatever id the caller
        // sent — better than blocking the save. The insert-then-retry
        // loop below will still handle a collision.
      }
    }

    // Use INSERT (not upsert). A collision surfaces as a 23505
    // unique_violation instead of silently overwriting the existing row —
    // the exact bug that used to corrupt cue001 when form state was stale.
    // If we hit a collision, bump the id and retry a few times.
    const trySave = async (payload, method) => {
      const q = supabase.from('prompts')
      const r = method === 'update'
        ? await q.update(payload).eq('id', payload.id).select().single()
        : await q.insert(payload).select().single()
      return r
    }

    let attempt = 0
    let currentPayload = toDb(payloadItem)
    let { data, error } = await trySave(currentPayload, isUpdate ? 'update' : 'insert')

    // Collision — pick a fresh id from a fresh DB read and retry.
    while (!isUpdate && error && /(?:23505|duplicate key|already exists|unique constraint)/i.test(error.message || '') && attempt < 3) {
      attempt++
      try {
        const { data: idRows2 } = await supabase.from('prompts').select('id')
        const nums = (idRows2 || [])
          .map((r) => parseInt(String(r.id).replace(/\D/g, ''), 10))
          .filter((n) => !Number.isNaN(n))
        const next = (nums.length ? Math.max(...nums) : 0) + 1
        payloadItem = { ...payloadItem, id: `cue${String(next).padStart(3, '0')}` }
      } catch { /* ignore, will fall through */ }
      currentPayload = toDb(payloadItem)
      ;({ data, error } = await trySave(currentPayload, 'insert'))
    }

    // Missing-column fallback (partner-schema DB without our newer columns).
    if (error) {
      const msg = error.message || ''
      const isMissingCol = /(?:could not find|does not exist|schema cache|not found|unknown column)/i.test(msg)
      if (isMissingCol) {
        // eslint-disable-next-line no-console
        console.warn('[cue] Save failed due to missing column; retrying with legacy payload:', msg)
        const retry = await trySave(toDbLegacy(payloadItem), isUpdate ? 'update' : 'insert')
        data = retry.data
        error = retry.error
      }
    }
    if (error) throw error

    if (payloadItem.prompt) {
      const { error: contentError } = await supabase
        .from('prompt_contents')
        .upsert({ prompt_id: data.id, content: payloadItem.prompt })
      if (contentError && !/(?:does not exist|schema cache|not found)/i.test(contentError.message || '')) {
        throw contentError
      }
    }

    return toJs(data)
  },
  
  // Beta waitlist signup. Handles duplicate emails gracefully (Postgres
   // returns 23505 unique_violation; we treat that as "already signed up").
  async subscribeWaitlist(email, source = 'homepage-hero') {
    const clean = String(email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      throw new Error('Please enter a valid email')
    }
    const { error } = await supabase
      .from('waitlist_emails')
      .insert({
        email: clean,
        source,
        referrer: typeof document !== 'undefined' ? (document.referrer || null) : null,
      })
    if (error) {
      const msg = error.message || ''
      if (/duplicate key|already exists|unique/i.test(msg)) {
        // Idempotent behaviour — treat as success from the user's POV.
        return { alreadyOnList: true }
      }
      // Missing table (partner hasn't run the migration yet). Fail softly
      // with a friendly message.
      if (/does not exist|schema cache|not found/i.test(msg)) {
        throw new Error('Waitlist is coming online — please try again shortly.')
      }
      throw error
    }
    return { alreadyOnList: false }
  },

  // Admin inbox — list feedback + waitlist submissions (newest first).
  // Client-side gated by isAdmin. Backend RLS is currently anon-open
  // (see supabase-migration-admin-inbox.sql). Tighten via edge function
  // before public launch.
  async listFeedback(limit = 200) {
    const { data, error } = await supabase
      .from('feedback')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data || []
  },

  async listWaitlist(limit = 500) {
    const { data, error } = await supabase
      .from('waitlist_emails')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data || []
  },

  // Anonymous feedback / component request submission.
  // kind: 'improvement' | 'component_request' | 'other'
  async submitFeedback({ kind, message, email, source = 'homepage-footer' }) {
    const cleanMsg = String(message || '').trim()
    if (!cleanMsg) throw new Error('Please write your suggestion')
    if (cleanMsg.length > 4000) throw new Error('Suggestion too long (max 4000 chars)')
    const cleanEmail = String(email || '').trim().toLowerCase() || null
    if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Please enter a valid email (or leave blank)')
    }
    const validKinds = new Set(['improvement', 'component_request', 'other'])
    const cleanKind = validKinds.has(kind) ? kind : 'other'

    const { error } = await supabase
      .from('feedback')
      .insert({
        kind: cleanKind,
        message: cleanMsg,
        email: cleanEmail,
        source,
        referrer: typeof document !== 'undefined' ? (document.referrer || null) : null,
      })
    if (error) {
      if (/does not exist|schema cache|not found/i.test(error.message || '')) {
        throw new Error('Feedback is coming online — please try again shortly.')
      }
      throw error
    }
    return { ok: true }
  },

  // ---- Feedback threading (reply system) ----------------------------
  // Each feedback row is the root of a thread. Both admin and user
  // messages live in feedback_messages.

  async listMessages(feedbackId) {
    const { data, error } = await supabase
      .from('feedback_messages')
      .select('*')
      .eq('feedback_id', feedbackId)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data || []
  },

  async postMessage({ feedbackId, body, author, authorEmail = null }) {
    const clean = String(body || '').trim()
    if (!clean) throw new Error('Empty message')
    if (clean.length > 4000) throw new Error('Message too long (max 4000 chars)')
    if (!['admin', 'user'].includes(author)) throw new Error('Invalid author')
    const { data, error } = await supabase
      .from('feedback_messages')
      .insert({
        feedback_id: feedbackId,
        body: clean,
        author,
        author_email: authorEmail,
      })
      .select()
      .single()
    if (error) throw error
    return data
  },

  // For a signed-in user: list feedback they've submitted (matched by
  // email) PLUS admin replies on those threads. Returns:
  //   [{ ...feedback, messages: [...], adminReplyCount, lastActivity }]
  async listThreadsForEmail(email) {
    if (!email) return []
    const lower = String(email).toLowerCase()
    const { data: feedback, error: fbErr } = await supabase
      .from('feedback')
      .select('*')
      .eq('email', lower)
      .order('created_at', { ascending: false })
    if (fbErr) throw fbErr
    if (!feedback || !feedback.length) return []
    const ids = feedback.map((f) => f.id)
    const { data: msgs, error: msgErr } = await supabase
      .from('feedback_messages')
      .select('*')
      .in('feedback_id', ids)
      .order('created_at', { ascending: true })
    if (msgErr) throw msgErr
    const byFb = new Map()
    ;(msgs || []).forEach((m) => {
      const arr = byFb.get(m.feedback_id) || []
      arr.push(m)
      byFb.set(m.feedback_id, arr)
    })
    return feedback.map((f) => {
      const messages = byFb.get(f.id) || []
      const adminReplies = messages.filter((m) => m.author === 'admin')
      const last = messages[messages.length - 1]
      return {
        ...f,
        messages,
        adminReplyCount: adminReplies.length,
        lastAdminReplyAt: adminReplies.length ? adminReplies[adminReplies.length - 1].created_at : null,
        lastActivity: last ? last.created_at : f.created_at,
      }
    })
  },

  // ---- Social layer: bookmarks / likes / views ----------------------

  async incrementView(promptId) {
    if (!promptId) return
    // Fire-and-forget RPC. If the function isn't installed yet (old DB),
    // the call fails silently — views just won't tick.
    try {
      await supabase.rpc('increment_view', { pid: promptId })
    } catch {}
  },

  async listBookmarks(userId) {
    if (!userId) return []
    const { data, error } = await supabase
      .from('prompt_bookmarks')
      .select('prompt_id')
      .eq('user_id', userId)
    if (error) return []
    return (data || []).map((r) => r.prompt_id)
  },
  async addBookmark(userId, promptId) {
    if (!userId || !promptId) return
    const { error } = await supabase
      .from('prompt_bookmarks')
      .insert({ user_id: userId, prompt_id: promptId })
    if (error && !/duplicate/i.test(error.message)) throw error
  },
  async removeBookmark(userId, promptId) {
    if (!userId || !promptId) return
    const { error } = await supabase
      .from('prompt_bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('prompt_id', promptId)
    if (error) throw error
  },

  async listLikes(userId) {
    if (!userId) return []
    const { data, error } = await supabase
      .from('prompt_likes')
      .select('prompt_id')
      .eq('user_id', userId)
    if (error) return []
    return (data || []).map((r) => r.prompt_id)
  },
  async addLike(userId, promptId) {
    if (!userId || !promptId) return
    const { error } = await supabase
      .from('prompt_likes')
      .insert({ user_id: userId, prompt_id: promptId })
    if (error && !/duplicate/i.test(error.message)) throw error
  },
  async removeLike(userId, promptId) {
    if (!userId || !promptId) return
    const { error } = await supabase
      .from('prompt_likes')
      .delete()
      .eq('user_id', userId)
      .eq('prompt_id', promptId)
    if (error) throw error
  },

  // Targeted partial update — only the fields in `patch` are written.
  // Used by inline toggles (e.g. star / feature) that shouldn't touch the
  // rest of the row.
  async updateFields(id, patch) {
    const { data, error } = await supabase
      .from('prompts')
      .update(patch)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
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
  
  // Legacy no-ops kept for AppContext compatibility. Auth is done via Clerk;
  // these methods are called by AppContext's older bootstrap path but the
  // real user identity comes from useUser() in components. Delete once the
  // AppContext user-state branch is removed.
  async getUser() { return null },
  onAuthChange() { return () => {} },
}

export const backend = supabaseAdapter
export const backendMode = backend.mode
export const isSupabaseConfigured = true // Always true now since we require it
