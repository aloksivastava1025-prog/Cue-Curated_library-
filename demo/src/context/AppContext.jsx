import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
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

  const isFiltering = useMemo(
    () => filter.section !== null || filter.pricing !== 'all' || filter.q.trim() !== '',
    [filter]
  )

  const addDraft = useCallback(async (item) => {
    const created = await backend.create(item)
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
    drafts, addDraft, removeDraft, clearDrafts, loadingDrafts,
    user,
    selectedItem, openItem, closeItem,
    toast, showToast,
    filter, updateFilter, clearFilter, isFiltering,
  }
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>
}

export function useApp() {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
