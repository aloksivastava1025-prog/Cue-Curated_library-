import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { prompts as seedPrompts } from '../data/prompts.js'
import { backend } from '../lib/backend.js'

const AppCtx = createContext(null)

const DEFAULT_FILTER = { section: null, pricing: 'all', sort: 'popular', q: '' }

function readInitialFilter() {
  if (typeof window === 'undefined') return DEFAULT_FILTER
  const u = new URL(window.location.href)
  return {
    section: u.searchParams.get('section') || null,
    pricing: u.searchParams.get('pricing') || 'all',
    sort: u.searchParams.get('sort') || 'popular',
    q: u.searchParams.get('q') || '',
  }
}
function readInitialItemId() {
  if (typeof window === 'undefined') return null
  return new URL(window.location.href).searchParams.get('item')
}
function writeToUrl(filter, item) {
  if (typeof window === 'undefined') return
  const u = new URL(window.location.href)
  const set = (k, v) => { if (v) u.searchParams.set(k, v); else u.searchParams.delete(k) }
  set('section', filter.section)
  set('pricing', filter.pricing !== 'all' ? filter.pricing : null)
  set('sort', filter.sort !== 'popular' ? filter.sort : null)
  set('q', filter.q)
  set('item', item?.id ?? null)
  window.history.replaceState({}, '', u.toString())
}

export function AppProvider({ children }) {
  const [drafts, setDrafts] = useState([])
  const [loadingDrafts, setLoadingDrafts] = useState(true)
  const [user, setUser] = useState(null)
  const [bookmarkedIds, setBookmarkedIds] = useState(() => new Set())
  const [likedIds, setLikedIds] = useState(() => new Set())
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const [feedbackSource, setFeedbackSource] = useState('nav')
  const { user: clerkUser, isSignedIn } = useUser()
  const clerkUserId = isSignedIn ? clerkUser?.id : null

  const allPrompts = useMemo(() => [...seedPrompts, ...drafts], [drafts])

  const [selectedItem, setSelectedItem] = useState(null)
  const [toast, setToast] = useState(null)
  const [filter, setFilter] = useState(readInitialFilter)

  // Initial fetch of drafts + auth subscription
  useEffect(() => {
    let mounted = true
    backend.list()
      .then((list) => { if (mounted) setDrafts(list) })
      .catch((err) => { console.error('Failed to load drafts', err) })
      .finally(() => { if (mounted) setLoadingDrafts(false) })
    backend.getUser().then((u) => { if (mounted) setUser(u) })
    const unsub = backend.onAuthChange((u) => { setUser(u) })
    return () => { mounted = false; unsub && unsub() }
  }, [])

  // Resolve ?item= once allPrompts populated
  useEffect(() => {
    const id = readInitialItemId()
    if (id) {
      const found = allPrompts.find((p) => p.id === id)
      if (found) setSelectedItem(found)
    }
  }, [allPrompts])

  const openItem = useCallback((item) => setSelectedItem(item), [])
  const closeItem = useCallback(() => setSelectedItem(null), [])
  const showToast = useCallback((message) => setToast({ message, id: Date.now() }), [])

  const updateFilter = useCallback((patch) => setFilter((f) => ({ ...f, ...patch })), [])
  const clearFilter = useCallback(() => setFilter(DEFAULT_FILTER), [])

  // Hydrate bookmarks + likes on sign-in; clear on sign-out.
  useEffect(() => {
    if (!clerkUserId) {
      setBookmarkedIds(new Set())
      setLikedIds(new Set())
      return
    }
    let alive = true
    Promise.all([
      backend.listBookmarks(clerkUserId),
      backend.listLikes(clerkUserId),
    ]).then(([bm, lk]) => {
      if (!alive) return
      setBookmarkedIds(new Set(bm))
      setLikedIds(new Set(lk))
    }).catch(() => {})
    return () => { alive = false }
  }, [clerkUserId])

  // Bump the in-memory prompt's like_count so the card reflects the change
  // instantly. Server trigger handles the persisted count.
  const bumpLikeCount = useCallback((promptId, delta) => {
    setDrafts((list) => list.map((p) => (
      p.id === promptId ? { ...p, like_count: Math.max((p.like_count || 0) + delta, 0) } : p
    )))
  }, [])

  // §3.4 — In-flight tracking: prevent double-clicks from sending
  // duplicate requests. Each item gets locked during its server round-trip.
  const inflightRef = useRef(new Set())

  // §3.4 — Intent-based bookmark: sends explicit add/remove, not toggle.
  // Disables re-entry during in-flight request to prevent race conditions.
  const toggleBookmark = useCallback(async (promptId) => {
    if (!clerkUserId) return { needsAuth: true }
    if (inflightRef.current.has(`bm:${promptId}`)) return {} // in-flight, ignore
    inflightRef.current.add(`bm:${promptId}`)

    const isSaved = bookmarkedIds.has(promptId)
    // Optimistic UI update
    setBookmarkedIds((prev) => {
      const next = new Set(prev)
      isSaved ? next.delete(promptId) : next.add(promptId)
      return next
    })
    try {
      // §3.4 — Explicit intent: add or remove, not toggle.
      if (isSaved) await backend.removeBookmark(clerkUserId, promptId)
      else         await backend.addBookmark(clerkUserId, promptId)
    } catch (e) {
      // Rollback on failure
      setBookmarkedIds((prev) => {
        const next = new Set(prev)
        isSaved ? next.add(promptId) : next.delete(promptId)
        return next
      })
    } finally {
      inflightRef.current.delete(`bm:${promptId}`)
    }
    return {}
  }, [clerkUserId, bookmarkedIds])

  // §3.4 — Intent-based like: sends explicit add/remove, not toggle.
  const toggleLike = useCallback(async (promptId) => {
    if (!clerkUserId) return { needsAuth: true }
    if (inflightRef.current.has(`lk:${promptId}`)) return {} // in-flight, ignore
    inflightRef.current.add(`lk:${promptId}`)

    const isLiked = likedIds.has(promptId)
    // Optimistic UI update
    setLikedIds((prev) => {
      const next = new Set(prev)
      isLiked ? next.delete(promptId) : next.add(promptId)
      return next
    })
    bumpLikeCount(promptId, isLiked ? -1 : +1)
    try {
      // §3.4 — Explicit intent: add or remove, not toggle.
      if (isLiked) await backend.removeLike(clerkUserId, promptId)
      else         await backend.addLike(clerkUserId, promptId)
    } catch (e) {
      // Rollback on failure
      setLikedIds((prev) => {
        const next = new Set(prev)
        isLiked ? next.add(promptId) : next.delete(promptId)
        return next
      })
      bumpLikeCount(promptId, isLiked ? +1 : -1)
    } finally {
      inflightRef.current.delete(`lk:${promptId}`)
    }
    return {}
  }, [clerkUserId, likedIds, bumpLikeCount])

  // View dedup — once per item per 12h per browser. Kills:
  //   1. React StrictMode useEffect double-fire (2x in dev)
  //   2. Same user open/close/reopen spam
  //   3. Refresh loops on the same item
  // Server still sees ONE bump per real, deliberate open.
  // Every open pings the server. Real dedup lives on the server
  // (record-view edge fn dedups by IP+UA hash + prompt_id + date via a
  // composite PK). The earlier 12-hour client-side lock made the UI
  // feel broken during testing — the counter never budged even after
  // opening the card. Optimistic UI: bump immediately so the reader
  // sees their view register; if the server rejects (dedup hit),
  // the number stays where the client already put it — never wrong-
  // direction, and next full refetch reconciles from truth.
  const registerView = useCallback((promptId) => {
    if (!promptId) return
    backend.incrementView(promptId).catch(() => {})
    setDrafts((list) => list.map((p) => (
      p.id === promptId ? { ...p, view_count: (p.view_count || 0) + 1 } : p
    )))
  }, [])

  const isFiltering = useMemo(
    () => filter.section !== null || filter.pricing !== 'all' || filter.q.trim() !== '',
    [filter]
  )

  const addDraft = useCallback(async (item, opts = {}) => {
    // Pass isUpdate through to the backend so edits UPDATE the existing
    // row instead of getting a fresh id + INSERT (which would silently
    // create a duplicate card).
    const created = await backend.create(item, opts)
    setDrafts((prev) => {
      const idx = prev.findIndex(p => p.id === created.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = created
        return next
      }
      return [...prev, created]
    })
    return created
  }, [])
  const removeDraft = useCallback(async (id) => {
    await backend.remove(id)
    setDrafts((prev) => prev.filter((p) => p.id !== id))
  }, [])

  // Inline partial update — for quick toggles like ★ Featured on a row
  // without opening the full edit form. Optimistic: updates local state
  // first, rolls back if the server call fails.
  const updateDraftFields = useCallback(async (id, patch) => {
    const prev = drafts
    setDrafts((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)))
    try {
      const updated = await backend.updateFields(id, patch)
      setDrafts((list) => list.map((p) => (p.id === id ? updated : p)))
      return updated
    } catch (e) {
      setDrafts(prev)
      throw e
    }
  }, [drafts])
  const clearDrafts = useCallback(async () => {
    await backend.clear()
    setDrafts([])
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2400)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => { writeToUrl(filter, selectedItem) }, [filter, selectedItem])

  useEffect(() => {
    const onPop = () => {
      setFilter(readInitialFilter())
      const id = readInitialItemId()
      const found = id ? allPrompts.find((p) => p.id === id) : null
      setSelectedItem(found || null)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [allPrompts])

  const value = {
    allPrompts,
    seedPrompts,
    drafts, addDraft, removeDraft, updateDraftFields, clearDrafts, loadingDrafts,
    user,
    selectedItem, openItem, closeItem,
    toast, showToast,
    filter, updateFilter, clearFilter, isFiltering,
    bookmarkedIds, likedIds,
    toggleBookmark, toggleLike, registerView,
    feedbackOpen, feedbackSource,
    openFeedback: (source = 'nav') => { setFeedbackSource(source); setFeedbackOpen(true) },
    closeFeedback: () => setFeedbackOpen(false),
  }
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp() {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
