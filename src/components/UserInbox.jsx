import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { backend } from '../lib/backend.js'

const LAST_SEEN_KEY_PREFIX = 'cue.user.inbox.lastSeen:'
const POLL_MS = 60_000

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso); if (isNaN(d)) return ''
  const diff = Date.now() - d.getTime()
  const m = Math.round(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const D = Math.round(h / 24)
  if (D < 7) return `${D}d ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Nav bell that shows unread admin replies to the signed-in user's own
// feedback threads. Renders nothing when signed out.
export default function UserInbox() {
  const { user, isSignedIn } = useUser()
  const email = isSignedIn ? user?.primaryEmailAddress?.emailAddress?.toLowerCase() : null
  const [open, setOpen] = useState(false)
  const [threads, setThreads] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [active, setActive] = useState(null) // feedback id whose thread is open
  const [drafts, setDraftsMap] = useState({}) // per-thread reply drafts, keyed by thread id
  const [sending, setSending] = useState(false)
  // Snapshot of lastSeen taken when the panel opens — used to compute
  // "new" highlights until the panel is closed. Without this, marking as
  // read on open would kill every unread highlight in the same frame.
  const [seenSnapshot, setSeenSnapshot] = useState(null)
  const rootRef = useRef(null)

  const seenKey = email ? LAST_SEEN_KEY_PREFIX + email : null
  const [lastSeen, setLastSeen] = useState(() => {
    if (!seenKey) return null
    try { return localStorage.getItem(seenKey) || null } catch { return null }
  })

  async function load() {
    if (!email) return
    setLoading(true); setError(null)
    try {
      const t = await backend.listThreadsForEmail(email)
      setThreads(t)
    } catch (e) {
      setError(e.message || String(e))
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (!email) return
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const unreadCount = useMemo(() => {
    const cutoff = lastSeen ? new Date(lastSeen).getTime() : 0
    let n = 0
    threads.forEach((t) => {
      (t.messages || []).forEach((m) => {
        if (m.author === 'admin' && new Date(m.created_at).getTime() > cutoff) n++
      })
    })
    return n
  }, [threads, lastSeen])

  function markSeen() {
    if (!seenKey) return
    const now = new Date().toISOString()
    try { localStorage.setItem(seenKey, now) } catch {}
    setLastSeen(now)
  }

  async function sendReply(threadId) {
    const body = (drafts[threadId] || '').trim()
    if (!body || sending) return
    setSending(true)
    try {
      await backend.postMessage({ feedbackId: threadId, body, author: 'user', authorEmail: email })
      setDraftsMap((d) => ({ ...d, [threadId]: '' }))
      await load()
    } catch (e) {
      setError(e.message || String(e))
    } finally { setSending(false) }
  }

  if (!isSignedIn || !email) return null

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        onClick={() => {
          const next = !open
          if (next) setSeenSnapshot(lastSeen)  // freeze highlight cutoff for this panel session
          setOpen(next)
          if (next) markSeen()
        }}
        aria-label="Messages"
        title="Messages from CUE"
        style={{
          background: 'transparent', border: '1px solid var(--border)',
          color: 'var(--text)', width: 34, height: 30, borderRadius: 999,
          cursor: 'pointer', position: 'relative',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16,
            padding: '0 4px', borderRadius: 999,
            background: 'var(--electric)', color: '#fff',
            fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          }}>{unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 380,
          maxHeight: '70vh', overflowY: 'auto',
          background: '#0d0d10', border: '1px solid var(--border)', borderRadius: 12,
          boxShadow: '0 30px 80px rgba(0,0,0,0.75)', zIndex: 200, padding: 14,
        }} data-lenis-prevent>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 10.5, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--electric)', fontWeight: 700 }}>Messages</div>
            <button onClick={load} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--text-dim)', fontSize: 11, cursor: 'pointer' }}>Refresh</button>
          </div>

          {loading && threads.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-dim)', padding: '20px 4px' }}>Loading…</div>}
          {error && <div style={{ fontSize: 12, color: 'var(--danger)', padding: '10px 4px' }}>{error}</div>}

          {!loading && !threads.length && (
            <div style={{ padding: '30px 6px', textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 20, color: 'var(--text)', marginBottom: 6 }}>Nothing yet.</div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.5 }}>
                Suggest an improvement using the button in the nav. If we reply, it'll show up here.
              </div>
            </div>
          )}

          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            {threads.map((t) => {
              // Use the frozen snapshot so highlights persist while the panel is open.
              const cutoff = seenSnapshot ? new Date(seenSnapshot).getTime() : 0
              const newAdmin = (t.messages || []).some((m) => m.author === 'admin' && new Date(m.created_at).getTime() > cutoff)
              const isOpen = active === t.id
              return (
                <li key={t.id} style={{
                  background: newAdmin ? 'rgba(0,0,255,0.06)' : '#0e0e10',
                  border: `1px solid ${newAdmin ? 'rgba(0,0,255,0.35)' : 'var(--border)'}`,
                  borderRadius: 8, padding: '10px 12px',
                }}>
                  <button
                    onClick={() => setActive(isOpen ? null : t.id)}
                    style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text)', padding: 0, cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
                        {t.kind === 'improvement' ? 'Improvement' : t.kind === 'component_request' ? 'Component' : 'Feedback'}
                      </span>
                      <span style={{ fontSize: 10.5, color: 'var(--text-dim)', marginLeft: 'auto' }}>{fmtDate(t.lastActivity)}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text)', lineHeight: 1.45, opacity: isOpen ? 1 : 0.85, whiteSpace: isOpen ? 'pre-wrap' : 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.message}
                    </div>
                    {!isOpen && t.adminReplyCount > 0 && (
                      <div style={{ marginTop: 4, fontSize: 10.5, color: 'var(--electric)' }}>
                        {t.adminReplyCount} {t.adminReplyCount === 1 ? 'reply' : 'replies'} from CUE
                      </div>
                    )}
                  </button>

                  {isOpen && (
                    <div style={{ marginTop: 10, borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
                      <div style={{ display: 'grid', gap: 6, marginBottom: 10 }}>
                        {(t.messages || []).map((m) => (
                          <div key={m.id} style={{
                            padding: '8px 10px', borderRadius: 6,
                            background: m.author === 'admin' ? 'rgba(0,0,255,0.10)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${m.author === 'admin' ? 'rgba(0,0,255,0.28)' : 'var(--border)'}`,
                          }}>
                            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: m.author === 'admin' ? 'var(--electric)' : 'var(--text-dim)', marginBottom: 2 }}>
                              {m.author === 'admin' ? 'CUE' : 'You'} · <span style={{ opacity: 0.7, fontWeight: 400 }}>{fmtDate(m.created_at)}</span>
                            </div>
                            <div style={{ fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.body}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <textarea
                          value={drafts[t.id] || ''}
                          onChange={(e) => setDraftsMap((d) => ({ ...d, [t.id]: e.target.value }))}
                          placeholder="Reply…"
                          rows={2}
                          data-lenis-prevent
                          style={{
                            flex: 1, padding: '8px 10px', background: '#0b0b0d', color: 'var(--text)',
                            border: '1px solid var(--border)', borderRadius: 6,
                            fontFamily: 'var(--font-sans)', fontSize: 12.5, lineHeight: 1.5,
                            outline: 'none', resize: 'vertical',
                          }}
                        />
                        {(() => {
                          const draft = drafts[t.id] || ''
                          const disabled = !draft.trim() || sending
                          return (
                            <button
                              onClick={() => sendReply(t.id)}
                              disabled={disabled}
                              style={{
                                padding: '8px 12px', borderRadius: 6,
                                background: disabled ? '#1c1c1e' : 'var(--electric)',
                                color: disabled ? 'var(--text-dimmer)' : '#fff',
                                border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                              }}>{sending ? '…' : 'Send'}</button>
                          )
                        })()}
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
