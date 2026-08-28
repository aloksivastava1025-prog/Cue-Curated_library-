import React, { useEffect, useMemo, useState } from 'react'
import { useUser } from '@clerk/clerk-react'
import { supabase } from '../lib/supabase.js'
import { usePageMeta } from '../hooks/usePageMeta.js'

/**
 * Admin — Founding poll responses.
 *
 * Reads every row from `poll_responses`, groups them by session_id
 * so one visitor renders as one line, and exposes:
 *   • top-of-page stats (started / completed / hot leads / emails)
 *   • a per-row table with Q1, Q2, Q3, email, time-on-site
 * so Alok never needs the Supabase SQL editor to check pulse.
 */

const POLL_ID = 'founding-signal-v3'

const BLOCKER_LABEL = {
  conditional_yes:      "I'll join once component I want is added",
  need_more_components: 'Not enough components yet',
  need_more_proof:      'Need more value proof',
  price_high:           '$99 feels expensive',
  no_need_now:          "Don't need it right now",
  missing_feature:      'Missing a component',
  other:                'Something else',
}

const COMMIT_LABEL = {
  yes:   'Yes',
  maybe: 'Maybe',
  no:    'No',
}

export default function AdminPolls() {
  usePageMeta({ title: 'Admin · Poll responses' })
  const { isSignedIn, user } = useUser()
  const isAdmin = isSignedIn && ['akashkumar7653099@gmail.com', 'aloksivastava1025@gmail.com', 'aloks.int@teachforindia.org']
    .includes(user?.primaryEmailAddress?.emailAddress)

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!isAdmin) { setLoading(false); return }
    let alive = true
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('poll_responses')
          .select('*')
          .like('poll_id', `${POLL_ID}%`)
          .order('created_at', { ascending: false })
          .limit(2000)
        if (error) throw error
        if (alive) setRows(data || [])
      } catch (e) {
        if (alive) setErr(e?.message || 'Load failed')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [isAdmin])

  // Group rows by session_id, then reduce each session to a single
  // row shape the table renders directly.
  const sessions = useMemo(() => {
    const bySession = new Map()
    for (const r of rows) {
      if (!bySession.has(r.session_id)) bySession.set(r.session_id, [])
      bySession.get(r.session_id).push(r)
    }
    const list = []
    for (const [sid, items] of bySession.entries()) {
      const findByPoll = (p) => items.find((x) => x.poll_id === p)
      const findByPrefix = (p) => items.find((x) => x.poll_id.startsWith(p))
      const q1 = findByPoll(`${POLL_ID}:blocker`)
      const q2 = findByPrefix(`${POLL_ID}:q2:`)
      const q3 = findByPoll(`${POLL_ID}:commit`)
      const em = findByPoll(`${POLL_ID}:email`)
      const oldest = items.reduce((a, b) => (a.created_at < b.created_at ? a : b))
      list.push({
        sid,
        q1: q1?.choice || null,
        q2Choice: q2?.choice || null,
        q2Text: q2?.free_text || null,
        q3: q3?.choice || null,
        email: em?.free_text || null,
        time: q1?.seconds_on_site || oldest.seconds_on_site,
        at: oldest.created_at,
        step: em ? 4 : q3 ? 3 : q2 ? 2 : q1 ? 1 : 0,
      })
    }
    // Newest sessions first.
    return list.sort((a, b) => (a.at < b.at ? 1 : -1))
  }, [rows])

  const filtered = useMemo(() => {
    if (filter === 'all') return sessions
    if (filter === 'hot') return sessions.filter((s) => s.q1 === 'conditional_yes')
    if (filter === 'email') return sessions.filter((s) => s.email)
    if (filter === 'yes') return sessions.filter((s) => s.q3 === 'yes')
    if (filter === 'completed') return sessions.filter((s) => s.step >= 3)
    return sessions
  }, [sessions, filter])

  const stats = useMemo(() => {
    const started = sessions.length
    const completed = sessions.filter((s) => s.step >= 3).length
    const gaveEmail = sessions.filter((s) => s.email).length
    const hotLeads = sessions.filter((s) => s.q1 === 'conditional_yes').length
    const wouldJoin = sessions.filter((s) => s.q3 === 'yes').length
    return { started, completed, gaveEmail, hotLeads, wouldJoin }
  }, [sessions])

  if (!isSignedIn) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text)' }}>
        <p style={{ fontSize: 14 }}>Sign in required.</p>
      </div>
    )
  }
  if (!isAdmin) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text)' }}>
        <p style={{ fontSize: 14 }}>Admins only.</p>
      </div>
    )
  }

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>Admin</div>
            <h1 style={{ margin: 0, fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontWeight: 300, fontSize: 42, letterSpacing: '-0.02em' }}>
              Poll responses
            </h1>
          </div>
          <a href="#/" style={{ fontSize: 12, color: 'var(--text-dim)', textDecoration: 'none' }}>← Home</a>
        </div>

        {/* Stat tiles */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 12, marginBottom: 32,
        }}>
          <Stat label="Started" value={stats.started} />
          <Stat label="Completed 3 steps" value={stats.completed} />
          <Stat label="Hot leads" value={stats.hotLeads} accent="#22c55e" />
          <Stat label="Would join at $99" value={stats.wouldJoin} accent="#ccff00" />
          <Stat label="Gave email" value={stats.gaveEmail} accent="var(--electric)" />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { key: 'all',       label: `All (${sessions.length})` },
            { key: 'completed', label: `Completed (${stats.completed})` },
            { key: 'hot',       label: `Hot leads (${stats.hotLeads})` },
            { key: 'yes',       label: `Yes at $99 (${stats.wouldJoin})` },
            { key: 'email',     label: `Gave email (${stats.gaveEmail})` },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                fontSize: 12, padding: '7px 14px', borderRadius: 999,
                background: filter === f.key ? 'var(--text)' : 'transparent',
                color: filter === f.key ? 'var(--bg)' : 'var(--text-dim)',
                border: `1px solid ${filter === f.key ? 'var(--text)' : 'var(--border)'}`,
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>

        {loading && <div style={{ color: 'var(--text-dim)', fontSize: 13 }}>Loading…</div>}
        {err && <div style={{ color: '#ff6b6b', fontSize: 13 }}>{err}</div>}

        {!loading && !err && filtered.length === 0 && (
          <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: '40px 0', textAlign: 'center' }}>
            No responses yet.
          </div>
        )}

        {!loading && filtered.length > 0 && (
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-dim)', textAlign: 'left' }}>
                  <Th>When</Th>
                  <Th>Q1 · Blocker</Th>
                  <Th>Q2 · Answer</Th>
                  <Th>Q3 · Commit</Th>
                  <Th>Email</Th>
                  <Th>Time</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.sid} style={{ borderTop: '1px solid var(--border)' }}>
                    <Td dim>{new Date(s.at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Td>
                    <Td>
                      {s.q1 ? (
                        <span style={{ color: s.q1 === 'conditional_yes' ? '#22c55e' : 'var(--text)' }}>
                          {BLOCKER_LABEL[s.q1] || s.q1}
                        </span>
                      ) : <em style={{ color: 'var(--text-dim)' }}>—</em>}
                    </Td>
                    <Td>
                      {s.q2Text ? (
                        <span style={{ color: 'var(--electric)' }} title={s.q2Text}>
                          {s.q2Text.length > 48 ? s.q2Text.slice(0, 48) + '…' : s.q2Text}
                        </span>
                      ) : s.q2Choice ? (
                        <span>{s.q2Choice}</span>
                      ) : <em style={{ color: 'var(--text-dim)' }}>—</em>}
                    </Td>
                    <Td>
                      {s.q3 ? (
                        <span style={{ color: s.q3 === 'yes' ? '#ccff00' : s.q3 === 'no' ? '#ff6b6b' : 'var(--text-dim)' }}>
                          {COMMIT_LABEL[s.q3] || s.q3}
                        </span>
                      ) : <em style={{ color: 'var(--text-dim)' }}>—</em>}
                    </Td>
                    <Td>
                      {s.email ? (
                        <a href={`mailto:${s.email}`} style={{ color: 'var(--electric)', textDecoration: 'none' }}>{s.email}</a>
                      ) : <em style={{ color: 'var(--text-dim)' }}>—</em>}
                    </Td>
                    <Td dim>{s.time ? `${s.time}s` : '—'}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border)',
      borderRadius: 12, padding: '16px 18px',
    }}>
      <div style={{ fontSize: 10.5, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-dim)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-serif)', fontSize: 28, fontWeight: 300, color: accent || 'var(--text)' }}>{value}</div>
    </div>
  )
}

function Th({ children }) {
  return <th style={{ padding: '10px 12px', fontWeight: 500, fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{children}</th>
}
function Td({ children, dim }) {
  return <td style={{ padding: '10px 12px', color: dim ? 'var(--text-dim)' : 'var(--text)', verticalAlign: 'top' }}>{children}</td>
}
