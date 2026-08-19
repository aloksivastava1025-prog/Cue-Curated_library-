import React, { useEffect, useMemo, useState } from 'react';
import { backend } from '../lib/backend.js';

const LAST_SEEN_KEY = 'cue.admin.inbox.lastSeen';

// Both feedback and waitlist rows are ordered by created_at, but the app-side
// column is created_at on the DB. Some legacy rows may come back with
// createdAt via backend transformers — support both.
const rowCreatedAt = (r) => r?.created_at || r?.createdAt || null;

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `${diffH}h ago`;
  const diffD = Math.round(diffH / 24);
  if (diffD < 7) return `${diffD}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function toCSV(rows, columns) {
  const esc = (v) => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
  };
  const head = columns.map((c) => c.label).join(',');
  const body = rows.map((r) => columns.map((c) => esc(c.get(r))).join(',')).join('\n');
  return head + '\n' + body;
}
function download(name, csv) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

const KIND_LABEL = {
  improvement: 'Improvement',
  component_request: 'Component request',
  other: 'Other',
};
const KIND_COLOR = {
  improvement: 'rgba(0,0,255,0.14)',
  component_request: 'rgba(204,255,0,0.14)',
  other: 'rgba(255,255,255,0.08)',
};

export default function AdminInbox() {
  const [tab, setTab] = useState('all'); // all | feedback | waitlist | monthly
  const [feedback, setFeedback] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [monthly, setMonthly] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastSeen, setLastSeen] = useState(() => {
    try { return localStorage.getItem(LAST_SEEN_KEY) || null; } catch { return null; }
  });

  async function load() {
    setLoading(true); setError(null);
    try {
      const [fb, wl, mo] = await Promise.all([
        backend.listFeedback(),
        backend.listWaitlist(),
        backend.listMonthlyWaitlist(),
      ]);
      setFeedback(fb); setWaitlist(wl); setMonthly(mo);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const unread = useMemo(() => {
    const cutoff = lastSeen ? new Date(lastSeen).getTime() : 0;
    const fbNew = feedback.filter((r) => new Date(rowCreatedAt(r)).getTime() > cutoff).length;
    const wlNew = waitlist.filter((r) => new Date(rowCreatedAt(r)).getTime() > cutoff).length;
    const moNew = monthly.filter((r) => new Date(rowCreatedAt(r)).getTime() > cutoff).length;
    return { feedback: fbNew, waitlist: wlNew, monthly: moNew, total: fbNew + wlNew + moNew };
  }, [feedback, waitlist, monthly, lastSeen]);

  function markAllRead() {
    const now = new Date().toISOString();
    try { localStorage.setItem(LAST_SEEN_KEY, now); } catch {}
    setLastSeen(now);
  }

  const merged = useMemo(() => {
    const fb = feedback.map((r) => ({ ...r, __kind: 'feedback', __ts: rowCreatedAt(r) }));
    const wl = waitlist.map((r) => ({ ...r, __kind: 'waitlist', __ts: rowCreatedAt(r) }));
    const mo = monthly.map((r) => ({ ...r, __kind: 'monthly',  __ts: rowCreatedAt(r) }));
    return [...fb, ...wl, ...mo].sort((a, b) => new Date(b.__ts || 0) - new Date(a.__ts || 0));
  }, [feedback, waitlist, monthly]);

  const rows = tab === 'feedback' ? feedback
             : tab === 'monthly'  ? monthly
             : tab === 'waitlist' ? waitlist
             : merged;

  const cutoffMs = lastSeen ? new Date(lastSeen).getTime() : 0;
  const isNew = (r) => new Date(rowCreatedAt(r)).getTime() > cutoffMs;

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: 'var(--font-sans)', color: 'var(--text)' }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20, background: '#060606',
        borderBottom: '1px solid var(--border)', padding: '14px 24px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <a href="#/admin" style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 20, color: 'var(--text)', textDecoration: 'none' }}>CUE</a>
        <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>Inbox</span>
        {unread.total > 0 && (
          <span style={{
            padding: '3px 8px', fontSize: 10.5, fontWeight: 700,
            borderRadius: 999, background: 'var(--electric)', color: '#fff',
            letterSpacing: '0.06em',
          }}>{unread.total} new</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <button onClick={load} style={btnGhost}>Refresh</button>
          <button onClick={markAllRead} style={btnGhost} disabled={unread.total === 0}>Mark all read</button>
          <a href="#/admin" style={{ ...btnGhost, textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>&larr; Back to admin</a>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding: '20px 24px 0', display: 'flex', justifyContent: 'center' }}>
        <div style={{ display: 'inline-flex', padding: 4, background: '#0e0e10', border: '1px solid var(--border)', borderRadius: 999, gap: 2 }}>
          {[
            { key: 'all',       label: 'All',        count: merged.length,   badge: unread.total },
            { key: 'feedback',  label: 'Feedback',   count: feedback.length, badge: unread.feedback },
            { key: 'waitlist',  label: 'Waitlist',   count: waitlist.length, badge: unread.waitlist },
            { key: 'monthly',   label: 'Monthly',    count: monthly.length,  badge: unread.monthly },
          ].map((t) => {
            const on = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{
                padding: '8px 18px', borderRadius: 999,
                background: on ? 'var(--electric)' : 'transparent',
                color: on ? '#fff' : 'var(--text-dim)',
                border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                <span>{t.label}</span>
                <span style={{ fontSize: 10, opacity: on ? 0.85 : 0.6 }}>{t.count}</span>
                {t.badge > 0 && (
                  <span style={{
                    minWidth: 16, height: 16, borderRadius: 999, padding: '0 5px',
                    fontSize: 9.5, fontWeight: 700, background: on ? '#fff' : '#ccff00',
                    color: on ? 'var(--electric)' : '#0A0A0A',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  }}>{t.badge}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Compose new message to a specific user */}
      <ComposeToUser onSent={load} />

      {/* Export bar */}
      <div style={{ maxWidth: 900, margin: '18px auto 0', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        {(tab === 'all' || tab === 'feedback') && feedback.length > 0 && (
          <button onClick={() => download('cue-feedback.csv', toCSV(feedback, [
            { label: 'created_at', get: (r) => rowCreatedAt(r) },
            { label: 'kind',       get: (r) => r.kind },
            { label: 'email',      get: (r) => r.email || '' },
            { label: 'message',    get: (r) => r.message },
            { label: 'source',     get: (r) => r.source || '' },
          ]))} style={btnGhost}>Export feedback CSV</button>
        )}
        {(tab === 'all' || tab === 'waitlist') && waitlist.length > 0 && (
          <button onClick={() => download('cue-waitlist.csv', toCSV(waitlist, [
            { label: 'created_at', get: (r) => rowCreatedAt(r) },
            { label: 'email',      get: (r) => r.email },
            { label: 'source',     get: (r) => r.source || '' },
          ]))} style={btnGhost}>Export waitlist CSV</button>
        )}
        {(tab === 'all' || tab === 'monthly') && monthly.length > 0 && (
          <button onClick={() => download('cue-monthly-interest.csv', toCSV(monthly, [
            { label: 'created_at', get: (r) => rowCreatedAt(r) },
            { label: 'email',      get: (r) => r.email },
            { label: 'source',     get: (r) => r.source || '' },
          ]))} style={btnGhost}>Export monthly CSV</button>
        )}
      </div>

      {/* Body */}
      <div style={{ maxWidth: 900, margin: '20px auto 80px', padding: '0 24px' }}>
        {loading && <div style={hint}>Loading…</div>}
        {error && (
          <div style={{ ...hint, color: '#ff6b6b' }}>
            Failed to load: {error}
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)' }}>
              Did you run <code>supabase-migration-admin-inbox.sql</code> in Supabase?
            </div>
          </div>
        )}
        {!loading && !error && rows.length === 0 && (
          <div style={{ ...hint, textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 28, color: 'var(--text)', marginBottom: 10 }}>All quiet.</div>
            <div>No submissions yet in this tab.</div>
          </div>
        )}

        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {rows.map((r) => {
            const inferKind = () => {
              if (r.__kind) return r.__kind;
              if (r.message !== undefined) return 'feedback';
              // Distinguish monthly vs waitlist by source pattern
              if (r.source === 'pricing-monthly') return 'monthly';
              return 'waitlist';
            };
            const kind = inferKind();
            const isFb = kind === 'feedback';
            const isMonthly = kind === 'monthly';
            const _new = isNew(r);
            return (
              <li key={`${kind}-${r.id || rowCreatedAt(r)}`} style={{
                background: _new ? 'rgba(0,0,255,0.05)' : '#0e0e10',
                border: `1px solid ${_new ? 'rgba(0,0,255,0.35)' : 'var(--border)'}`,
                borderRadius: 8, padding: '14px 16px',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: isFb && r.message ? 8 : 0 }}>
                  <span style={{
                    padding: '2px 8px', fontSize: 10, fontWeight: 700, borderRadius: 999,
                    background: isFb
                      ? (KIND_COLOR[r.kind] || KIND_COLOR.other)
                      : isMonthly
                        ? 'rgba(0,0,255,0.14)'
                        : 'rgba(255,255,255,0.06)',
                    color: 'var(--text)', letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>
                    {isFb ? (KIND_LABEL[r.kind] || 'Feedback')
                          : isMonthly ? 'Monthly interest'
                          : 'Waitlist'}
                  </span>
                  {r.source && (
                    <span style={{ fontSize: 10.5, color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
                      via {r.source}
                    </span>
                  )}
                  {r.email && (
                    <a href={`mailto:${r.email}`} style={{ fontSize: 12, color: 'var(--electric)', textDecoration: 'none' }}>
                      {r.email}
                    </a>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-dim)' }}>{fmtDate(rowCreatedAt(r))}</span>
                  {_new && (
                    <span style={{
                      padding: '2px 6px', fontSize: 9, fontWeight: 700, borderRadius: 3,
                      background: 'var(--electric)', color: '#fff', letterSpacing: '0.08em',
                    }}>NEW</span>
                  )}
                </div>
                {isFb && r.message && (
                  <div style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>
                    {r.message}
                  </div>
                )}
                {isFb && <FeedbackThread feedback={r} />}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

// Inline expandable thread on each feedback card — shows admin/user
// replies chronologically and lets admin post a new reply.
function FeedbackThread({ feedback }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const canReply = !!feedback.email;

  async function load() {
    setLoading(true); setErr('');
    try {
      const m = await backend.listMessages(feedback.id);
      setMessages(m);
    } catch (e) { setErr(e.message || String(e)); }
    finally { setLoading(false); }
  }

  useEffect(() => { if (open) load(); }, [open, feedback.id]);

  async function send(e) {
    e.preventDefault();
    if (!reply.trim() || sending) return;
    setSending(true); setErr('');
    try {
      await backend.postMessage({ feedbackId: feedback.id, body: reply, author: 'admin' });
      setReply('');
      await load();
    } catch (e) { setErr(e.message || String(e)); }
    finally { setSending(false); }
  }

  const adminCount = messages.filter((m) => m.author === 'admin').length;
  const userCount  = messages.filter((m) => m.author === 'user').length;

  return (
    <div style={{ marginTop: 10, borderTop: '1px dashed var(--border)', paddingTop: 10 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          background: 'transparent', border: 'none', color: 'var(--text-dim)',
          fontSize: 11.5, cursor: 'pointer', padding: 0,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
        title={canReply ? 'Show / hide thread' : 'No email on this feedback — cannot reply'}
      >
        <span>{open ? '▾' : '▸'}</span>
        <span>{open ? 'Hide' : 'Reply'}</span>
        {(adminCount > 0 || userCount > 0) && (
          <span style={{ fontSize: 10.5 }}>
            · {adminCount + userCount} messages
            {userCount > 0 && <span style={{ marginLeft: 6, color: '#ccff00' }}>· {userCount} from user</span>}
          </span>
        )}
        {!canReply && <span style={{ marginLeft: 6, fontSize: 10.5, color: 'var(--danger)' }}>no email attached</span>}
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          {loading && <div style={{ fontSize: 11.5, color: 'var(--text-dim)' }}>Loading…</div>}

          {messages.length > 0 && (
            <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
              {messages.map((m) => (
                <div key={m.id} style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: m.author === 'admin' ? 'rgba(0,0,255,0.10)' : 'rgba(204,255,0,0.06)',
                  border: `1px solid ${m.author === 'admin' ? 'rgba(0,0,255,0.28)' : 'rgba(204,255,0,0.22)'}`,
                  alignSelf: m.author === 'admin' ? 'flex-end' : 'flex-start',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: m.author === 'admin' ? 'var(--electric)' : '#ccff00',
                    }}>{m.author === 'admin' ? 'You' : 'User'}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text-dim)' }}>{fmtDate(m.created_at)}</span>
                  </div>
                  <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{m.body}</div>
                </div>
              ))}
            </div>
          )}

          {canReply ? (
            <form onSubmit={send} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder={`Reply to ${feedback.email}…`}
                rows={2}
                data-lenis-prevent
                style={{
                  flex: 1, padding: '8px 10px',
                  background: '#0b0b0d', color: 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: 6,
                  fontFamily: 'var(--font-sans)', fontSize: 12.5, lineHeight: 1.5,
                  outline: 'none', resize: 'vertical',
                }}
              />
              <button type="submit" disabled={!reply.trim() || sending} style={{
                padding: '8px 14px', borderRadius: 6,
                background: (!reply.trim() || sending) ? '#1c1c1e' : 'var(--electric)',
                color: (!reply.trim() || sending) ? 'var(--text-dimmer)' : '#fff',
                border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}>{sending ? 'Sending…' : 'Send'}</button>
            </form>
          ) : (
            <div style={{ fontSize: 11.5, color: 'var(--text-dim)', fontStyle: 'italic' }}>
              User didn't leave an email — no way to route a reply.
            </div>
          )}

          {err && <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--danger)' }}>{err}</div>}
        </div>
      )}
    </div>
  );
}

const btnGhost = {
  padding: '6px 12px', fontSize: 11.5, borderRadius: 999,
  background: 'transparent', border: '1px solid var(--border)',
  color: 'var(--text)', cursor: 'pointer', letterSpacing: '0.04em',
  fontFamily: 'var(--font-sans)',
};
const hint = {
  padding: '30px 8px', color: 'var(--text-dim)', fontSize: 13,
};

// -----------------------------------------------------------------
// Compose a fresh admin-to-user message. Creates a new feedback row
// with source='admin-initiated' plus the first admin message; the
// user's existing UserInbox bell picks it up on their next poll (60s
// interval) and shows the unread badge.
// -----------------------------------------------------------------
function ComposeToUser({ onSent }) {
  const [open, setOpen] = useState(false);
  const [toEmail, setToEmail] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');

  async function submit(e) {
    e.preventDefault();
    setErr(''); setOk('');
    if (sending) return;
    setSending(true);
    try {
      await backend.adminMessageUser({ toEmail, body });
      setOk(`Message sent to ${toEmail}. They'll see it in their inbox bell next poll.`);
      setBody('');
      setToEmail('');
      if (onSent) await onSent();
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: '18px auto 0', padding: '0 24px' }}>
      <div style={{
        background: '#0e0e10', border: '1px solid var(--border)', borderRadius: 10,
        overflow: 'hidden',
      }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{
            width: '100%', padding: '12px 16px', background: 'transparent',
            border: 'none', color: 'var(--text)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 10,
            fontFamily: 'var(--font-sans)', fontSize: 12.5, textAlign: 'left',
          }}
        >
          <span style={{
            width: 22, height: 22, borderRadius: 999,
            background: 'rgba(0,0,255,0.16)', color: '#fff',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700,
          }}>✉</span>
          <span style={{ fontWeight: 600 }}>Compose message to a user</span>
          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
            {open ? '— close' : '— start a fresh thread with any signed-up user by email'}
          </span>
          <span style={{ marginLeft: 'auto', color: 'var(--text-dim)' }}>{open ? '▾' : '▸'}</span>
        </button>

        {open && (
          <form onSubmit={submit} style={{ padding: '4px 16px 16px', display: 'grid', gap: 10 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                To (user's email)
              </span>
              <input
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="user@example.com"
                required
                autoComplete="off"
                style={{
                  padding: '9px 12px', borderRadius: 6,
                  background: '#0a0a0c', border: '1px solid var(--border)',
                  color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-sans)',
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-dim)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Message
              </span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write a short, direct message. Markdown not supported yet — plain text only. Max 4000 chars."
                required
                rows={5}
                maxLength={4000}
                style={{
                  padding: '10px 12px', borderRadius: 6,
                  background: '#0a0a0c', border: '1px solid var(--border)',
                  color: 'var(--text)', fontSize: 13, fontFamily: 'var(--font-sans)',
                  resize: 'vertical', minHeight: 100, lineHeight: 1.5,
                }}
              />
              <span style={{ fontSize: 10.5, color: 'var(--text-dim)', textAlign: 'right' }}>
                {body.length} / 4000
              </span>
            </label>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button
                type="submit"
                disabled={!toEmail.trim() || !body.trim() || sending}
                style={{
                  padding: '9px 18px', borderRadius: 999,
                  background: (!toEmail.trim() || !body.trim() || sending) ? '#1c1c1e' : 'var(--electric)',
                  color: (!toEmail.trim() || !body.trim() || sending) ? 'var(--text-dimmer)' : '#fff',
                  border: 'none', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                  letterSpacing: '0.02em',
                }}
              >
                {sending ? 'Sending…' : 'Send message'}
              </button>
              <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                Delivered inside CUE — user sees a badge on their nav inbox bell within a minute.
              </span>
            </div>
            {ok  && <div style={{ fontSize: 11.5, color: '#ccff00' }}>{ok}</div>}
            {err && <div style={{ fontSize: 11.5, color: 'var(--danger)' }}>{err}</div>}
          </form>
        )}
      </div>
    </div>
  );
}
