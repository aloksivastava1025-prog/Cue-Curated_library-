import { supabase } from './supabase.js'

// ============================================================
// CUE v2.0 — Hardened Backend Adapter
// ============================================================
// Changes from v1:
//   §3.3  Server-side prompt ID via next_prompt_id() RPC
//   §3.4  Intent-based like/bookmark (explicit like/unlike, not toggle)
//   §3.5  View counter delegated to record-view edge function
//   §4.6  Admin audit log on all admin mutations
//   General: stale-response protection via sequence numbers
// ============================================================

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
  
  // ================================================================
  // §3.3 — Server-side prompt ID generation
  // ================================================================
  // For new items: call next_prompt_id() RPC to get a collision-proof
  // ID from the Postgres sequence. No more client-picked IDs + retry.
  // For updates: keep the existing ID unchanged.
  // ================================================================
  async create(item, opts = {}) {
    const isUpdate = opts.isUpdate === true
    let payloadItem = item

    if (!isUpdate) {
      // Try the server-side sequence first (v2 hardened path).
      try {
        const { data: seqId, error: seqErr } = await supabase.rpc('next_prompt_id')
        if (!seqErr && seqId) {
          payloadItem = { ...item, id: seqId }
        } else {
          // Fallback: sequence not deployed yet. Use the old max-ID approach
          // but still better than client-picked IDs.
          const { data: idRows } = await supabase.from('prompts').select('id')
          const nums = (idRows || [])
            .map((r) => parseInt(String(r.id).replace(/\D/g, ''), 10))
            .filter((n) => !Number.isNaN(n))
          const next = (nums.length ? Math.max(...nums) : 0) + 1
          payloadItem = { ...item, id: `cue${String(next).padStart(3, '0')}` }
        }
      } catch {
        // If we can't query, fall through with whatever id the caller
        // sent — better than blocking the save.
      }
    }

    // Use INSERT (not upsert). A collision surfaces as a 23505
    // unique_violation instead of silently overwriting the existing row.
    const trySave = async (payload, method) => {
      const q = supabase.from('prompts')
      const r = method === 'update'
        ? await q.update(payload).eq('id', payload.id).select().single()
        : await q.insert(payload).select().single()
      return r
    }

    let currentPayload = toDb(payloadItem)
    let { data, error } = await trySave(currentPayload, isUpdate ? 'update' : 'insert')

    // Collision on insert — sequence should prevent this, but handle
    // gracefully for the fallback path. One retry with a fresh sequence ID.
    if (!isUpdate && error && /(?:23505|duplicate key|already exists|unique constraint)/i.test(error.message || '')) {
      try {
        const { data: seqId2 } = await supabase.rpc('next_prompt_id')
        if (seqId2) {
          payloadItem = { ...payloadItem, id: seqId2 }
          currentPayload = toDb(payloadItem)
          ;({ data, error } = await trySave(currentPayload, 'insert'))
        }
      } catch { /* ignore, will fall through */ }
    }

    // Missing-column fallback (partner-schema DB without our newer columns).
    if (error) {
      const msg = error.message || ''
      // Narrow to Postgres/PostgREST column-missing shapes only. The old
      // regex ("does not exist" / "not found") matched too broadly — an
      // unrelated RLS or FK error could trigger the legacy fallback and
      // silently strip `code`/`tags` from the payload.
      const isMissingCol = /column .* does not exist|could not find the '.*' column|unknown column|schema cache.*column/i.test(msg)
      if (isMissingCol) {
        // eslint-disable-next-line no-console
        console.warn('[cue] Save failed due to missing column; retrying with legacy payload:', msg)
        const retry = await trySave(toDbLegacy(payloadItem), isUpdate ? 'update' : 'insert')
        data = retry.data
        error = retry.error
      }
    }
    if (error) throw error

    // Round-trip guard: if the caller sent `code` but the DB returned null,
    // the save silently dropped it (usually because a legacy-fallback retry
    // stripped the column). Retry a targeted UPDATE of just the code column
    // so admin never has to re-enter it. Logs a warning either way.
    const sentCode = payloadItem.code && String(payloadItem.code).trim()
    if (sentCode && !data.code) {
      // eslint-disable-next-line no-console
      console.warn('[cue] Save returned null code despite sending it — patching now.', { id: data.id })
      const { data: patched, error: patchErr } = await supabase
        .from('prompts')
        .update({ code: payloadItem.code })
        .eq('id', data.id)
        .select()
        .single()
      if (patchErr) {
        // eslint-disable-next-line no-console
        console.error('[cue] code round-trip patch failed:', patchErr.message)
      } else {
        data = patched
      }
    }

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

    // Fire-and-forget welcome email. Never await — if Resend is
    // slow or misconfigured the signup UX shouldn't wait for it.
    // The edge fn itself is a no-op when RESEND_API_KEY is unset.
    supabase.functions.invoke('send-waitlist-welcome', {
      body: { email: clean, source },
    }).catch((e) => console.warn('waitlist welcome email failed', e?.message))
    return { alreadyOnList: false }
  },

  // Monthly waitlist — fake-door demand test for $49/mo tier.
  // Restored during v2 hardening merge; MonthlyWaitlistModal + AdminInbox
  // Monthly tab depend on this helper.
  async joinMonthlyWaitlist({ email, source = 'pricing-page' }) {
    const clean = String(email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error('Please enter a valid email')
    const { error } = await supabase
      .from('monthly_waitlist')
      .insert({ email: clean, source, referrer: typeof document !== 'undefined' ? (document.referrer || null) : null })
    if (error) {
      if (/duplicate|unique/i.test(error.message || '')) return { alreadyOnList: true }
      if (/does not exist|schema cache|not found/i.test(error.message || '')) {
        throw new Error('Waitlist is coming online — please try again shortly.')
      }
      throw error
    }
    return { alreadyOnList: false }
  },

  async listMonthlyWaitlist(limit = 500) {
    const { data, error } = await supabase
      .from('monthly_waitlist')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return []
    return data || []
  },

  // Founding counter — how many paying Cue+ users so far.
  // Reads from user_profiles.plan; returns 0 if table doesn't exist yet.
  // Founding count for the scarcity counter. Excludes:
  //   - admin/team internal accounts (self-test purchases)
  //   - reconciliation-source rows (self-heal artifacts from
  //     manual DB fixes rather than real buyers)
  // Result matches the pricing card + hero pill on both surfaces.
  async getFoundingCount() {
    try {
      // NOTE: aloksivastava1025@gmail.com intentionally NOT here —
      // it's the founder's own row and counts as founding member #1
      // so the pricing counter never shows a hollow "0 of 50".
      const ADMIN_EMAILS = [
        'aloks.int@teachforindia.org',
        'akashkumar7653099@gmail.com',
        'srivastavaalok2214@gmail.com',
      ]
      const { data, error } = await supabase
        .from('user_profiles')
        .select('email, plan_source')
        .eq('plan', 'cue_plus')
      if (error || !data) return 0
      const real = data.filter((r) => {
        const em = (r.email || '').toLowerCase()
        if (ADMIN_EMAILS.includes(em)) return false
        if (r.plan_source === 'reconciliation') return false
        if (r.plan_source === 'manual_link_dodo_email_mismatch') return false
        return true
      })
      return real.length
    } catch { return 0 }
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

  // All active Cue+ / Cue+ Team subscriptions. Admin view only —
  // gated by RLS + the isAdmin check on the page. Returns rows in
  // reverse-chronological order (newest paid first).
  async listActiveSubscriptions(limit = 500) {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('user_id, email, plan, plan_source, plan_started_at, plan_expires_at, dodo_customer_id, team_seats')
      .in('plan', ['cue_plus', 'cue_plus_team'])
      .order('plan_started_at', { ascending: false })
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

  async listMonthlyWaitlist(limit = 500) {
    const { data, error } = await supabase
      .from('monthly_waitlist')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return []
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

  // Monthly waitlist — fake-door demand test for $49/mo tier.
  async joinMonthlyWaitlist({ email, source = 'pricing-page' }) {
    const clean = String(email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error('Please enter a valid email')
    const { error } = await supabase
      .from('monthly_waitlist')
      .insert({ email: clean, source, referrer: typeof document !== 'undefined' ? (document.referrer || null) : null })
    if (error) {
      if (/duplicate|unique/i.test(error.message || '')) return { alreadyOnList: true }
      if (/does not exist|schema cache|not found/i.test(error.message || '')) {
        throw new Error('Waitlist is coming online — please try again shortly.')
      }
      throw error
    }
    return { alreadyOnList: false }
  },

  // ---- User profiles + onboarding -----------------------------------

  // Ensures a row exists for this Clerk user. Called on every sign-in.
  // Idempotent — on conflict do nothing.
  // Manually re-run the paid-but-locked reconciliation.
  // Called from /billing/success if 20s of polling hasn't unlocked the user.
  async reconcile() {
    try {
      const { data } = await supabase.rpc('reconcile_paid_but_locked')
      return data || null
    } catch { return null }
  },

  async ensureUserProfile(clerkUser) {
    if (!clerkUser?.id) return null
    const email = clerkUser.primaryEmailAddress?.emailAddress || ''
    const firstName = clerkUser.firstName || ''
    const lastName = clerkUser.lastName || ''
    const full_name = `${firstName} ${lastName}`.trim() || null

    // First: call the merge RPC so any pre-existing self-healed row
    // (from a payment that landed before this Clerk user signed in)
    // gets linked to this Clerk user_id and their plan is preserved.
    try {
      await supabase.rpc('link_user_profile_to_clerk', {
        p_clerk_user_id: clerkUser.id,
        p_email:         email,
        p_full_name:     full_name,
      })
    } catch { /* fall through to plain upsert */ }

    // Then upsert to fill any missing fields on the (possibly newly-
    // linked) row.
    const { data, error } = await supabase
      .from('user_profiles')
      .upsert({
        user_id: clerkUser.id,
        email:   email.toLowerCase(),
        full_name,
      }, { onConflict: 'user_id', ignoreDuplicates: false })
      .select()
      .single()
    if (error) {
      if (/does not exist|not found/i.test(error.message || '')) return null
      console.warn('ensureUserProfile', error)
      return null
    }
    return data
  },

  async getMyProfile(clerkUserId, clerkUserObject = null) {
    if (!clerkUserId) return null
    // First: try direct user_id match (fast path — post-merge state)
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('user_id', clerkUserId)
      .maybeSingle()
    if (!error && data) return data

    // Fallback: try email match. This covers the pre-merge state where
    // a self-healed row exists with user_id='dodo:...' but the Clerk user
    // just signed in and ensureUserProfile hasn't finished merging yet.
    // Requires the caller to pass the Clerk user object.
    const email = clerkUserObject?.primaryEmailAddress?.emailAddress
    if (email) {
      const { data: byEmail } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('email', email.toLowerCase())
        .maybeSingle()
      if (byEmail) return byEmail
    }
    return null
  },

  async updateMyProfile(clerkUserId, patch) {
    if (!clerkUserId) throw new Error('Not signed in')
    const clean = {}
    if (patch.display_name !== undefined) clean.display_name = String(patch.display_name).trim() || null
    if (patch.avatar_url !== undefined)   clean.avatar_url   = patch.avatar_url || null
    if (patch.onboarded_at !== undefined) clean.onboarded_at = patch.onboarded_at
    const { data, error } = await supabase
      .from('user_profiles')
      .update(clean)
      .eq('user_id', clerkUserId)
      .select()
      .single()
    if (error) {
      if (/duplicate|unique/i.test(error.message || '') && clean.display_name) {
        throw new Error('That username is taken. Try another.')
      }
      throw error
    }
    return data
  },

  async uploadAvatar(clerkUserId, file) {
    if (!clerkUserId || !file) throw new Error('Missing file')
    if (file.size > 5 * 1024 * 1024) throw new Error('Image must be under 5MB')
    if (!/^image\//.test(file.type)) throw new Error('Only images (PNG / JPEG / WebP) allowed')
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `avatars/${clerkUserId}-${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('cue-media')
      .upload(path, file, { contentType: file.type, cacheControl: '31536000', upsert: true })
    if (error) throw error
    const { data } = supabase.storage.from('cue-media').getPublicUrl(path)
    return data.publicUrl
  },

  // Founding counter — how many paying Cue+ users so far.
  // Reads from user_profiles.plan; returns 0 if table doesn't exist yet.
  // Founding count for the scarcity counter. Excludes:
  //   - admin/team internal accounts (self-test purchases)
  //   - reconciliation-source rows (self-heal artifacts from
  //     manual DB fixes rather than real buyers)
  // Result matches the pricing card + hero pill on both surfaces.
  async getFoundingCount() {
    try {
      // NOTE: aloksivastava1025@gmail.com intentionally NOT here —
      // it's the founder's own row and counts as founding member #1
      // so the pricing counter never shows a hollow "0 of 50".
      const ADMIN_EMAILS = [
        'aloks.int@teachforindia.org',
        'akashkumar7653099@gmail.com',
        'srivastavaalok2214@gmail.com',
      ]
      const { data, error } = await supabase
        .from('user_profiles')
        .select('email, plan_source')
        .eq('plan', 'cue_plus')
      if (error || !data) return 0
      const real = data.filter((r) => {
        const em = (r.email || '').toLowerCase()
        if (ADMIN_EMAILS.includes(em)) return false
        if (r.plan_source === 'reconciliation') return false
        if (r.plan_source === 'manual_link_dodo_email_mismatch') return false
        return true
      })
      return real.length
    } catch { return 0 }
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

  // Admin-initiated conversation — starts a fresh thread with any
  // user by email. Reuses the feedback + feedback_messages tables so
  // the user's existing inbox bell picks it up automatically. The
  // feedback row records who the message is TO (email), and the
  // actual message body lives in feedback_messages so the read-count
  // arithmetic in listThreadsForEmail stays consistent.
  async adminMessageUser({ toEmail, body }) {
    const clean = String(body || '').trim()
    if (!clean) throw new Error('Empty message')
    if (clean.length > 4000) throw new Error('Message too long (max 4000 chars)')
    const emailLower = String(toEmail || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
      throw new Error('Enter a valid recipient email')
    }
    // 1. Root feedback row — marks the thread as admin-initiated.
    const { data: fb, error: fbErr } = await supabase
      .from('feedback')
      .insert({
        kind: 'other',
        message: '(Admin-initiated conversation)',
        email: emailLower,
        source: 'admin-initiated',
      })
      .select()
      .single()
    if (fbErr) throw fbErr
    // 2. First message — the actual body — attributed to admin so the
    // user's inbox counts it as an unread admin reply.
    const { data: msg, error: msgErr } = await supabase
      .from('feedback_messages')
      .insert({
        feedback_id: fb.id,
        body: clean,
        author: 'admin',
        author_email: null,
      })
      .select()
      .single()
    if (msgErr) throw msgErr

    // Fire-and-forget email so the customer gets a real note in
    // their inbox, not just a bell in UserInbox. Never blocks.
    supabase.functions.invoke('send-admin-message', {
      body: { toEmail: emailLower, body: clean, isNewThread: true },
    }).catch((e) => console.warn('admin-message email failed', e?.message))

    return { feedback: fb, message: msg }
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

    // If this is an admin reply, email the customer so they
    // don't have to come back to the site to see the reply.
    // Look up the parent feedback row to find the recipient
    // email — the same row the reply is attached to.
    if (author === 'admin') {
      supabase
        .from('feedback')
        .select('email')
        .eq('id', feedbackId)
        .maybeSingle()
        .then(({ data: fb }) => {
          const to = fb?.email
          if (to) {
            supabase.functions.invoke('send-admin-message', {
              body: { toEmail: to, body: clean, isNewThread: false },
            }).catch((e) => console.warn('admin-reply email failed', e?.message))
          }
        })
        .catch(() => { /* ignore — bell notification still fires */ })
    }

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

  // ================================================================
  // §3.4 — INTENT-BASED SOCIAL LAYER (like/unlike, not toggle)
  // ================================================================
  // Client sends explicit intent ('like' / 'unlike'), never "toggle
  // from what I currently see." Server makes it idempotent with
  // ON CONFLICT DO NOTHING / plain DELETE.
  // ================================================================

  // §3.5 — View counter: now delegated to record-view edge function.
  // The old client-side increment_view RPC is revoked from anon (see
  // migration). This method calls the edge function instead.
  async incrementView(promptId) {
    if (!promptId) return
    try {
      await supabase.functions.invoke('record-view', {
        body: { prompt_id: promptId },
      })
    } catch {
      // Fire-and-forget. If the edge function isn't deployed yet,
      // views just won't tick — no user-facing error.
    }
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

  // §3.4 — Intent-based bookmark: explicit add, idempotent via ON CONFLICT.
  async addBookmark(userId, promptId) {
    if (!userId || !promptId) return
    const { error } = await supabase
      .from('prompt_bookmarks')
      .insert({ user_id: userId, prompt_id: promptId })
    if (error && !/duplicate/i.test(error.message)) throw error
  },

  // §3.4 — Intent-based unbookmark: explicit remove, idempotent (DELETE
  // on a non-existent row is a no-op in Postgres).
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

  // §3.4 — Intent-based like: explicit add, idempotent via ON CONFLICT.
  async addLike(userId, promptId) {
    if (!userId || !promptId) return
    const { error } = await supabase
      .from('prompt_likes')
      .insert({ user_id: userId, prompt_id: promptId })
    if (error && !/duplicate/i.test(error.message)) throw error
  },

  // §3.4 — Intent-based unlike: explicit remove, idempotent.
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
  
  // Server-side Dodo checkout session for the founding-lifetime plan.
  // This is the ONLY correct attribution path — metadata.user_id is set
  // by the edge function so the webhook can bind the payment to the
  // right Clerk user even when the customer types a different email
  // into Dodo's hosted checkout.
  // Free tier: 2 AI prompt copies per rolling 24h window per user.
  // Cue+ / Cue+ Team: unlimited (returns remaining = -1).
  async recordDailyCopy(userId) {
    if (!userId) return { allowed: false, remaining: 0 }
    const { data, error } = await supabase.rpc('record_daily_copy', { p_user_id: userId })
    if (error) {
      console.warn('recordDailyCopy failed', error)
      return { allowed: true, remaining: 0, error: error.message }
    }
    return data || { allowed: true, remaining: 0 }
  },

  async peekDailyCopy(userId) {
    if (!userId) return { allowed: false, remaining: 0 }
    const { data, error } = await supabase.rpc('peek_daily_copy', { p_user_id: userId })
    if (error) {
      console.warn('peekDailyCopy failed', error)
      return { allowed: true, remaining: 0 }
    }
    return data || { allowed: true, remaining: 0 }
  },

  async getMyBilling(clerkUser) {
    if (!clerkUser?.id) return null
    const email = clerkUser?.primaryEmailAddress?.emailAddress
      || clerkUser?.emailAddresses?.[0]?.emailAddress
      || null
    const { data, error } = await supabase.functions.invoke('get-my-billing', {
      body: { userId: clerkUser.id, email },
    })
    if (error) throw new Error(error.message || 'Could not load billing')
    return data
  },

  async createFoundingCheckout(clerkUser, { billingCycle = 'lifetime', planType = 'cue_plus' } = {}) {
    if (!clerkUser?.id) throw new Error('Sign in required')
    const email = clerkUser?.primaryEmailAddress?.emailAddress
      || clerkUser?.emailAddresses?.[0]?.emailAddress
    if (!email) throw new Error('No email on Clerk user')
    const name = clerkUser?.fullName
      || [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ')
      || 'Cue User'

    // Detect buyer's country client-side. Supabase edge functions run
    // on Deno Deploy (no cf-ipcountry header), so we have to look it
    // up from the browser and pass it explicitly. Cloudflare's trace
    // endpoint is CORS-open, tiny, and returns accurate geo. Non-fatal:
    // if it fails, edge function will just fall back to 'IN'.
    let buyerCountry = ''
    try {
      const resp = await fetch('https://www.cloudflare.com/cdn-cgi/trace', { cache: 'no-store' })
      const text = await resp.text()
      const m = text.match(/^loc=([A-Z]{2})$/m)
      if (m) buyerCountry = m[1]
    } catch { /* fall through to server default */ }

    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: {
        plan_type: planType,
        billing_cycle: billingCycle,
        customerEmail: email,
        customerName: name,
        userId: clerkUser.id,
        buyerCountry,
      },
    })
    if (error) {
      let msg = error.message || 'Checkout failed'
      try {
        if (error.context?.json) {
          const j = await error.context.json()
          if (j?.error) msg = j.error
          if (j?.dodo_status || j?.dodo_body) {
            msg += ` (Dodo ${j.dodo_status || ''}: ${(j.dodo_body || '').slice(0, 300)})`
          }
        }
      } catch { /* ignore */ }
      throw new Error(msg)
    }
    if (!data?.url) throw new Error('No checkout URL returned')
    return data.url
  },

  // Cancel a monthly subscription at period end. Access continues
  // through the current billing cycle; auto-renew is turned off.
  // Idempotent — a second call for an already-cancelled subscription
  // returns { already_cancelled: true } without hitting Dodo again.
  async cancelSubscription(clerkUserId) {
    if (!clerkUserId) throw new Error('Sign in required')
    const { data, error } = await supabase.functions.invoke('cancel-subscription', {
      body: { userId: clerkUserId },
    })
    if (error) {
      let msg = error.message || 'Cancellation failed'
      try {
        if (error.context?.json) {
          const j = await error.context.json()
          if (j?.error) msg = j.error
        }
      } catch { /* ignore */ }
      throw new Error(msg)
    }
    return data
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

  // §4.6 — Admin audit log. Call this from admin UI after mutations.
  async logAdminAction(actorEmail, action, targetType, targetId, before = null, after = null, metadata = null) {
    try {
      await supabase.rpc('log_admin_action', {
        p_actor_email: actorEmail,
        p_action: action,
        p_target_type: targetType,
        p_target_id: targetId,
        p_before: before,
        p_after: after,
        p_metadata: metadata,
      })
    } catch {
      // Fire-and-forget — audit logging should never break the admin flow.
      // If the function isn't deployed yet, we silently skip.
    }
  },

  // Get user's plan from user_profiles (for entitlement checks).
  async getUserPlan(userId) {
    if (!userId) return { plan: 'free' }
    const { data, error } = await supabase
      .from('user_profiles')
      .select('plan, plan_source, plan_started_at, plan_expires_at')
      .eq('user_id', userId)
      .maybeSingle()
    if (error || !data) return { plan: 'free' }
    // Check if plan has expired (null = lifetime, never expires).
    if (data.plan_expires_at && new Date(data.plan_expires_at) < new Date()) {
      return { plan: 'free' }
    }
    return data
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
