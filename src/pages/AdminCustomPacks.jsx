import React, { useEffect, useMemo, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { backend } from '../lib/backend.js'

// Admin-only dashboard for reviewing custom-pack requests and moving
// them through the pipeline (pending → quoted → paid | declined).
// Reads via the admin-custom-packs edge function (service-role behind
// an email whitelist), never directly — RLS on custom_pack_requests
// blocks anon reads.

const PAGE_ADMIN_EMAILS = new Set([
  'aloks.int@teachforindia.org',
  'aloksivastava1025@gmail.com',
  'akashkumar7653099@gmail.com',
  'srivastavaalok2214@gmail.com',
])

const STATUS_ORDER = ['pending', 'quoted', 'paid', 'declined']

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function AdminCustomPacks() {
  const { isLoaded, isSignedIn, user } = useUser()
  const isAdmin = isSignedIn && PAGE_ADMIN_EMAILS.has((user?.primaryEmailAddress?.emailAddress || '').toLowerCase())

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [prompts, setPrompts] = useState([])
  const [filter, setFilter] = useState('all')

  const load = () => {
    setLoading(true); setErr('')
    Promise.all([
      backend.listCustomPackRequests(user),
      backend.list(),
    ])
      .then(([reqs, all]) => {
        setRows(reqs || [])
        setPrompts(all || [])
      })
      .catch((e) => setErr(e?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  const promptById = useMemo(() => {
    const m = new Map()
    for (const p of prompts) m.set(p.id, p)
    return m
  }, [prompts])

  const counts = useMemo(() => {
    const c = { all: rows.length, pending: 0, quoted: 0, paid: 0, declined: 0 }
    for (const r of rows) c[r.status] = (c[r.status] || 0) + 1
    return c
  }, [rows])

  const visible = filter === 'all' ? rows : rows.filter((r) => r.status === filter)

  const changeStatus = async (row, next) => {
    if (row.status === next) return
    try {
      const updated = await backend.updateCustomPackRequest(user, row.id, { status: next })
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)))
    } catch (e) {
      alert(e?.message || 'Update failed')
    }
  }

  const saveNote = async (row, note) => {
    try {
      const updated = await backend.updateCustomPackRequest(user, row.id, { admin_note: note })
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, ...updated } : r)))
    } catch (e) {
      alert(e?.message || 'Update failed')
    }
  }

  if (!isLoaded) return null
  if (!isAdmin) {
    return (
      <div style={{ padding: 100, textAlign: 'center', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
        <a href="/" style={{ color: 'var(--text-dim)' }}>← Back</a>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 32, marginTop: 24 }}>Access denied</h1>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '40px 24px 80px', fontFamily: 'var(--font-sans)', color: 'var(--text)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <a href="/admin" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: 12 }}>← Admin</a>
      </div>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: 40, margin: '4px 0 4px' }}>
        Custom pack requests
      </h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 24px' }}>
        Every submission from the "Build a custom pack" flow. Move through pending → quoted → paid | declined. Reply to the user via their email or DM them on X.
      </p>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {['all', ...STATUS_ORDER].map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            style={{
              background: filter === k ? 'rgba(61,80,232,0.14)' : 'transparent',
              border: '1px solid ' + (filter === k ? 'rgba(61,80,232,0.5)' : 'var(--border)'),
              color: filter === k ? 'var(--electric, #fff)' : 'var(--text-dim)',
              padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
              letterSpacing: '0.02em',
            }}
          >
            {k} · {counts[k] || 0}
          </button>
        ))}
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={load} disabled={loading} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {err && (
        <div style={{ padding: '10px 14px', marginBottom: 16, background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff6b6b', borderRadius: 8, fontSize: 13 }}>
          {err}
        </div>
      )}

      {loading && rows.length === 0 && (
        <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
      )}
      {!loading && visible.length === 0 && (
        <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 13 }}>No requests in this bucket.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {visible.map((row) => (
          <RequestCard
            key={row.id}
            row={row}
            promptById={promptById}
            onChangeStatus={changeStatus}
            onSaveNote={saveNote}
          />
        ))}
      </div>
    </div>
  )
}

function RequestCard({ row, promptById, onChangeStatus, onSaveNote }) {
  const [note, setNote] = useState(row.admin_note || '')
  const [savingNote, setSavingNote] = useState(false)
  const picked = (row.component_ids || []).map((id) => promptById.get(id)).filter(Boolean)
  const orphaned = (row.component_ids || []).filter((id) => !promptById.get(id))

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 16, background: 'rgba(255,255,255,0.02)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, color: 'var(--text)', fontWeight: 500 }}>
            {row.name || row.email}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 2 }}>
            <a href={`mailto:${row.email}`} style={{ color: 'var(--text-dim)' }}>{row.email}</a>
            {' · '}
            {fmtDate(row.created_at)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => onChangeStatus(row, s)}
              style={{
                padding: '5px 10px', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase',
                borderRadius: 6, cursor: 'pointer',
                background: row.status === s ? statusColour(s).bg : 'transparent',
                color: row.status === s ? statusColour(s).fg : 'var(--text-dim)',
                border: '1px solid ' + (row.status === s ? statusColour(s).bd : 'var(--border)'),
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {row.message && (
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
          {row.message}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <div style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 8 }}>
          Picked · {row.component_ids?.length || 0}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
          {picked.map((p) => (
            <a key={p.id} href={`#/?item=${encodeURIComponent(p.id)}`} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                {p.thumbSrc && (
                  <img src={p.thumbSrc} alt={p.title} loading="lazy" style={{ width: '100%', height: 88, objectFit: 'cover', display: 'block' }} />
                )}
                <div style={{ padding: '6px 8px', fontSize: 11, color: 'var(--text)' }}>
                  {p.title || p.id}
                  <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>{p.id}{p.tier === 'paid' ? ' · premium' : ''}</div>
                </div>
              </div>
            </a>
          ))}
          {orphaned.map((id) => (
            <div key={id} style={{ padding: 10, fontSize: 11, color: 'var(--text-dim)', border: '1px dashed rgba(255,255,255,0.15)', borderRadius: 8 }}>
              {id} · unknown
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Internal note (quoted price, DM status, etc.)"
          rows={2}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            color: '#fff', fontSize: 12,
            padding: '8px 10px', borderRadius: 6, outline: 'none',
            fontFamily: 'inherit', resize: 'vertical',
          }}
        />
        <button
          onClick={async () => { setSavingNote(true); await onSaveNote(row, note); setSavingNote(false) }}
          disabled={savingNote || note === (row.admin_note || '')}
          style={{
            background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)',
            padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
            opacity: (savingNote || note === (row.admin_note || '')) ? 0.4 : 1,
          }}
        >
          {savingNote ? 'Saving…' : 'Save note'}
        </button>
      </div>
    </div>
  )
}

function statusColour(s) {
  switch (s) {
    case 'pending':  return { bg: 'rgba(255,180,0,0.14)',  fg: '#ffb400', bd: 'rgba(255,180,0,0.4)' }
    case 'quoted':   return { bg: 'rgba(61,80,232,0.14)',   fg: '#a3a3ff', bd: 'rgba(61,80,232,0.5)'  }
    case 'paid':     return { bg: 'rgba(34,197,94,0.14)', fg: '#22c55e', bd: 'rgba(34,197,94,0.5)' }
    case 'declined': return { bg: 'rgba(255,107,107,0.14)', fg: '#ff6b6b', bd: 'rgba(255,107,107,0.5)' }
    default:         return { bg: 'transparent', fg: 'var(--text-dim)', bd: 'var(--border)' }
  }
}
