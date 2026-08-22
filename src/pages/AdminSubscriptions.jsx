import React, { useEffect, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { backend } from '../lib/backend.js'

// Admin-only. Renders every currently-active Cue+ subscription with
// a classification pill so it's obvious at a glance which rows are
// admin test accounts (excluded from the founding cap) vs real
// customers (counted).
// Classification filter for the founding-cap count. Keep in sync
// with src/lib/backend.js and supabase/functions/create-checkout.
// aloksivastava1025@gmail.com intentionally excluded from this set
// so the founder's own row shows up as "Real customer" (#1).
const ADMIN_EMAILS = new Set([
  'aloks.int@teachforindia.org',
  'akashkumar7653099@gmail.com',
  'srivastavaalok2214@gmail.com',
])

// Separate list for page access — every admin identity that should
// be allowed to see the Subscriptions dashboard, including the
// founder's own gmail. Kept apart from ADMIN_EMAILS because that one
// is a *filter* (rows to hide from the count), not an *authz* check.
const PAGE_ADMIN_EMAILS = new Set([
  'aloksivastava1025@gmail.com',
  'aloks.int@teachforindia.org',
  'akashkumar7653099@gmail.com',
  'srivastavaalok2214@gmail.com',
])
const FILTERED_SOURCES = new Set(['reconciliation', 'manual_link_dodo_email_mismatch'])

function classify(row) {
  const em = (row.email || '').toLowerCase()
  if (ADMIN_EMAILS.has(em)) return { label: 'Admin', tone: 'muted', filtered: true }
  if (FILTERED_SOURCES.has(row.plan_source)) return { label: 'Reconciled', tone: 'muted', filtered: true }
  return { label: 'Real customer', tone: 'accent', filtered: false }
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function AdminSubscriptions() {
  const { isLoaded, isSignedIn, user } = useUser()
  const isAdmin = isSignedIn && PAGE_ADMIN_EMAILS.has((user?.primaryEmailAddress?.emailAddress || '').toLowerCase())

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = () => {
    setLoading(true); setErr('')
    backend.listActiveSubscriptions(500)
      .then((data) => setRows(data))
      .catch((e) => setErr(e?.message || 'Failed to load'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { if (isAdmin) load() }, [isAdmin])

  if (!isLoaded) return null
  if (!isAdmin) {
    return (
      <div style={{ padding: 100, textAlign: 'center', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
        <a href="#/" style={{ color: 'var(--text-dim)' }}>← Back</a>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 32, marginTop: 24 }}>Access denied</h1>
      </div>
    )
  }

  const real = rows.filter((r) => !classify(r).filtered)
  const filtered = rows.filter((r) => classify(r).filtered)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 24px 80px', fontFamily: 'var(--font-sans)', color: 'var(--text)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <a href="#/admin" style={{ color: 'var(--text-dim)', textDecoration: 'none', fontSize: 12 }}>← Admin</a>
      </div>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 400, fontSize: 40, margin: '4px 0 4px' }}>
        Active subscriptions
      </h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, margin: '0 0 28px' }}>
        Every row with <code style={{ background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: 4 }}>plan = cue_plus / cue_plus_team</code>. Real customers count toward the 50-founding cap; admin and reconciled rows are excluded.
      </p>

      {/* Summary strip */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
        <Stat label="Real customers" value={real.length} accent />
        <Stat label="Admin / reconciled" value={filtered.length} />
        <Stat label="Total rows" value={rows.length} />
        <Stat label="Founding seats left" value={Math.max(50 - real.length, 0)} />
      </div>

      {err && (
        <div style={{ padding: '10px 14px', marginBottom: 16, background: 'rgba(255,107,107,0.08)', border: '1px solid rgba(255,107,107,0.3)', color: '#ff6b6b', borderRadius: 8, fontSize: 13 }}>
          {err}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 12, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>All rows</div>
        <button onClick={load} disabled={loading} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.4fr 1.4fr', padding: '12px 16px', background: '#0f0f11', fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
          <div>Email</div>
          <div>Plan</div>
          <div>Source</div>
          <div>Started</div>
          <div>Status</div>
        </div>
        {loading && rows.length === 0 && (
          <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>
        )}
        {!loading && rows.length === 0 && (
          <div style={{ padding: 24, color: 'var(--text-dim)', fontSize: 13 }}>No active subscriptions yet.</div>
        )}
        {rows.map((r) => {
          const cls = classify(r)
          return (
            <div key={r.user_id} style={{
              display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1.4fr 1.4fr',
              padding: '14px 16px', borderTop: '1px solid var(--border)',
              alignItems: 'center', fontSize: 13,
              background: cls.filtered ? 'transparent' : 'rgba(0,0,255,0.04)',
            }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.email || '(no email)'}</div>
              <div style={{ color: 'var(--text-dim)' }}>{r.plan}</div>
              <div style={{ color: 'var(--text-dim)', fontFamily: 'var(--font-mono, monospace)', fontSize: 11 }}>{r.plan_source || '—'}</div>
              <div style={{ color: 'var(--text-dim)', fontSize: 12 }}>{fmtDate(r.plan_started_at)}</div>
              <div>
                <span style={{
                  fontSize: 10.5, letterSpacing: '0.06em', textTransform: 'uppercase', fontWeight: 700,
                  padding: '4px 9px', borderRadius: 999,
                  background: cls.tone === 'accent' ? 'rgba(0,0,255,0.16)' : 'rgba(255,255,255,0.05)',
                  color: cls.tone === 'accent' ? 'var(--electric)' : 'var(--text-dim)',
                  border: '1px solid ' + (cls.tone === 'accent' ? 'rgba(0,0,255,0.35)' : 'var(--border)'),
                }}>{cls.label}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div style={{
      padding: '12px 18px', borderRadius: 8,
      border: '1px solid ' + (accent ? 'rgba(0,0,255,0.35)' : 'var(--border)'),
      background: accent ? 'rgba(0,0,255,0.08)' : 'transparent',
      minWidth: 160,
    }}>
      <div style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 500, marginTop: 4, color: accent ? 'var(--electric)' : 'var(--text)' }}>{value}</div>
    </div>
  )
}
