import React, { useRef, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { backend } from '../lib/backend.js';
import { supabase } from '../lib/supabase.js';
import { useUser } from '@clerk/clerk-react';
import EditorialCard from '../components/EditorialCard.jsx';
import '../styles/overhaul.css';

const CATEGORIES = [
  'Text Animations', 'Visual Effects', 'Scroll Animations', 'Sliders & Marquees',
  'Page Transitions', 'Navigation', 'Loaders', 'Gallery & Images', 'Utilities & Scripts',
  'Sections & Layouts', 'Cursor Animations', 'Video & Audio', 'Buttons', 'Gimmicks',
  'Hover Interactions', 'Filters & Sorting', 'Forms', '3D & WebGL'
];

// Fields the AI is ALLOWED to suggest. Everything else (id, prompt, media,
// createdAt, status) is locked — the button cannot touch them.
const AI_ALLOWED_FIELDS = ['title', 'category', 'tags', 'description', 'stack', 'use_case', 'component_type', 'tier'];

function nextId(existing) {
  let n = 1;
  const nums = existing.map((p) => parseInt(p.id.replace(/\\D/g, ''), 10)).filter((x) => !Number.isNaN(x));
  if (nums.length) n = Math.max(...nums) + 1;
  return `cue${String(n).padStart(3, '0')}`;
}

const EMPTY_FORM = {
  id: 'cue001',
  title: '',
  category: '',
  tier: 'free',
  thumbSrc: '',
  hoverSrc: '',
  prompt: '',
  code: '',
  link: '',
  description: '',
  use_case: '',
  component_type: '', // 'section' | 'interaction'
  tags: [],
  stack: [],
  status: 'published',
};

// --- Small chip-input helper ---------------------------------------------
function ChipInput({ value = [], onChange, placeholder, suggestions = [] }) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const addChip = (raw) => {
    const t = raw.trim().replace(/,+$/, '');
    if (!t) return;
    if (value.includes(t)) return;
    onChange([...value, t]);
    setDraft('');
  };
  const removeChip = (i) => {
    const next = value.slice();
    next.splice(i, 1);
    onChange(next);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(draft);
    } else if (e.key === 'Backspace' && !draft && value.length) {
      removeChip(value.length - 1);
    }
  };

  return (
    <div>
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center',
          padding: '8px 10px', background: '#0e0e10', border: '1px solid var(--border)',
          borderRadius: '3px', minHeight: '42px', cursor: 'text'
        }}
      >
        {value.map((tag, i) => (
          <span key={`${tag}-${i}`} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '3px 8px', background: 'rgba(0,0,255,0.12)', color: 'var(--text)',
            border: '1px solid rgba(0,0,255,0.28)', borderRadius: '999px',
            fontSize: '11px', fontWeight: 500, letterSpacing: '0.02em'
          }}>
            {tag}
            <button
              onClick={(e) => { e.stopPropagation(); removeChip(i); }}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '14px' }}
              aria-label={`Remove ${tag}`}
            >×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => draft && addChip(draft)}
          placeholder={value.length === 0 ? placeholder : ''}
          style={{ flex: 1, minWidth: '120px', background: 'transparent', border: 'none', color: 'var(--text)', outline: 'none', fontSize: '13px', fontFamily: 'var(--font-sans)' }}
        />
      </div>
      {suggestions.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
          {suggestions.filter(s => !value.includes(s)).map(s => (
            <button
              key={s}
              onClick={() => addChip(s)}
              style={{
                padding: '3px 8px', background: 'transparent', color: 'var(--text-dim)',
                border: '1px solid var(--border)', borderRadius: '999px',
                fontSize: '10px', letterSpacing: '0.04em', cursor: 'pointer'
              }}
            >+ {s}</button>
          ))}
        </div>
      )}
    </div>
  );
}

const STACK_SUGGESTIONS = ['CSS', 'JavaScript', 'React', 'GSAP', 'Framer Motion', 'Three.js', 'WebGL', 'Canvas', 'SVG', 'Tailwind', 'Next.js'];

// A single uploaded-resource row: real thumbnail (video first-frame OR image),
// clean labels, type + tier badges, and edit / delete actions.
const IMG_EXT_RE = /\.(jpe?g|gif|png|webp|svg|heic|avif)$/i;
function ResourceRow({ p, isActive, onEdit, onDelete }) {
  const isPaid = p.tier === 'paid' || p.price === 'premium';
  const isDraft = p.status === 'draft';
  const primaryCategory = String(p.category || '').split(',')[0].trim();
  // Figure out the best preview source: thumb wins, else hover media, else letter.
  const thumb = p.thumbSrc;
  const hover = p.hoverSrc;
  let mediaEl = null;
  if (thumb) {
    mediaEl = <img src={thumb} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  } else if (hover) {
    mediaEl = IMG_EXT_RE.test(hover)
      ? <img src={hover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : <video src={hover} muted playsInline preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover', background: '#000' }} />;
  } else {
    mediaEl = <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '26px', color: 'var(--text-dim)' }}>{(p.title || '?').charAt(0).toUpperCase()}</span>;
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '112px 1fr auto auto',
      gap: '16px',
      padding: '14px 18px',
      alignItems: 'center',
      background: isActive ? 'rgba(0,0,255,0.05)' : 'var(--card-bg)',
      border: `1px solid ${isActive ? 'var(--electric)' : 'var(--border)'}`,
      borderRadius: '6px',
    }}>
      {/* Thumbnail */}
      <div style={{ width: '112px', aspectRatio: '16 / 10', background: 'var(--card-img-bg)', borderRadius: '4px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {mediaEl}
      </div>

      {/* Meta */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '14.5px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '360px' }}>{p.title || '(untitled)'}</span>
          {p.component_type === 'section' && (
            <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', letterSpacing: '0.08em' }}>SECTION</span>
          )}
          {p.component_type === 'interaction' && (
            <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', letterSpacing: '0.08em' }}>INTERACTION</span>
          )}
          {isPaid && <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(0,0,255,0.15)', color: 'var(--electric)', border: '1px solid rgba(0,0,255,0.4)', borderRadius: '3px' }}>🔒 Cue+</span>}
          {isDraft && <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: '3px' }}>DRAFT</span>}
        </div>
        {p.description
          ? <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.description}</div>
          : null}
        <div style={{ fontSize: '11px', color: 'var(--text-dimmer)', marginTop: '5px', letterSpacing: '0.02em' }}>
          <span style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>{primaryCategory || 'Uncategorized'}</span>
          {Array.isArray(p.tags) && p.tags.length > 0 && (
            <> · {p.tags.slice(0, 4).join(' · ')}{p.tags.length > 4 ? ` +${p.tags.length - 4}` : ''}</>
          )}
          <span style={{ marginLeft: '10px', opacity: 0.6 }}>{p.id}</span>
        </div>
      </div>

      {/* Date */}
      <div style={{ fontSize: '11.5px', color: 'var(--text-dimmer)', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {new Date(p.createdAt || Date.now()).toLocaleDateString()}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        <button onClick={() => onEdit(p)} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--electric)', border: '1px solid rgba(0,0,255,0.35)', borderRadius: '3px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Edit</button>
        <button onClick={() => onDelete(p.id)} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--danger)', border: '1px solid rgba(255,77,77,0.25)', borderRadius: '3px', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', cursor: 'pointer' }}>Delete</button>
      </div>
    </div>
  );
}

// Persistent inline status line — for uploads. Colors: gray = pending, green = ok, red = fail.
function StatusLine({ status }) {
  if (!status) return null;
  const color = status.ok === null ? 'var(--text-dim)' : status.ok ? '#4ade80' : 'var(--danger)';
  const prefix = status.ok === null ? '⋯' : status.ok ? '✓' : '✕';
  return (
    <div style={{ fontSize: '11px', color, marginTop: '6px', lineHeight: 1.4, wordBreak: 'break-word' }}>
      {prefix} {status.msg}
    </div>
  );
}

// --- Autofill preview modal ---------------------------------------------
function AutofillPreview({ suggestions, current, onApply, onCancel }) {
  // Users choose per-field whether to accept the AI suggestion. Prompt/code/
  // media/id/status are NOT in this modal — they cannot be affected.
  const [pick, setPick] = useState(() => {
    const p = {};
    for (const f of AI_ALLOWED_FIELDS) p[f] = true;
    return p;
  });

  const rows = AI_ALLOWED_FIELDS.map(f => {
    const now = current[f];
    const next = suggestions[f];
    const nowStr = Array.isArray(now) ? now.join(', ') : (now || '(empty)');
    const nextStr = Array.isArray(next) ? next.join(', ') : (next || '(none)');
    const same = nowStr === nextStr;
    return { field: f, nowStr, nextStr, same };
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} data-lenis-prevent style={{ background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', width: '100%', maxWidth: '640px', maxHeight: '85vh', overflow: 'auto', padding: '28px' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '26px', fontWeight: 400, marginBottom: '6px' }}>AI suggestions</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginBottom: '20px', lineHeight: 1.5 }}>
          The prompt/code, media, ID, and status are <span style={{ color: 'var(--text)' }}>never touched</span> — only metadata below.
          Uncheck any field you want to keep as-is.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
          {rows.map(({ field, nowStr, nextStr, same }) => (
            <div key={field} style={{ padding: '12px 14px', background: '#0e0e10', border: `1px solid ${same ? 'var(--border)' : 'rgba(0,0,255,0.28)'}`, borderRadius: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: same ? 'default' : 'pointer' }}>
                <input
                  type="checkbox"
                  checked={pick[field] && !same}
                  disabled={same}
                  onChange={e => setPick(p => ({ ...p, [field]: e.target.checked }))}
                />
                <span style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600 }}>{field}</span>
                {same && <span style={{ fontSize: '10px', color: 'var(--text-dimmer)', marginLeft: 'auto' }}>no change</span>}
              </label>
              {!same && (
                <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12px' }}>
                  <div>
                    <div style={{ color: 'var(--text-dimmer)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Current</div>
                    <div style={{ color: 'var(--text-dim)' }}>{nowStr}</div>
                  </div>
                  <div>
                    <div style={{ color: 'var(--electric)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>AI suggestion</div>
                    <div style={{ color: 'var(--text)' }}>{nextStr}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => onApply(pick)}
            style={{ flex: 1, padding: '12px', background: 'var(--electric)', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
          >Apply selected</button>
          <button
            onClick={onCancel}
            style={{ padding: '12px 18px', background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '13px', cursor: 'pointer' }}
          >Cancel</button>
        </div>
      </div>
    </div>
  );
}

// =========================================================================
export default function Admin() {
  const { allPrompts, addDraft, removeDraft, showToast } = useApp();
  const { isLoaded, isSignedIn, user } = useUser();
  const fileRef = useRef(null);
  const videoRef = useRef(null);

  const [form, setForm] = useState(() => ({ ...EMPTY_FORM }));
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [autofilling, setAutofilling] = useState(false);
  const [autofillPreview, setAutofillPreview] = useState(null); // {suggestions}
  const [autofillError, setAutofillError] = useState(null); // persistent inline error
  // Inline, persistent upload status — the ephemeral toast alone is easy to miss.
  const [uploadStatus, setUploadStatus] = useState({ image: null, video: null }); // { image: {ok, msg}, video: {ok, msg} }
  const [saveError, setSaveError] = useState(null); // persistent submit error

  useEffect(() => {
    if (!isEditing) {
      setForm(f => ({ ...f, id: nextId(allPrompts) }));
    }
  }, [allPrompts, isEditing]);

  const isAdmin = isSignedIn && ['akashkumar7653099@gmail.com', 'aloksivastava1025@gmail.com'].includes(user?.primaryEmailAddress?.emailAddress);

  if (!isLoaded) return <div style={{ color: '#fff', padding: '100px', textAlign: 'center' }}>Loading...</div>;
  if (!isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '120px', color: 'var(--text)', fontFamily: 'var(--font-sans)' }}>
        <a href="#/" style={{ alignSelf: 'center', marginBottom: '24px', color: 'var(--text-dim)', textDecoration: 'none' }}>← Back to library</a>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '32px', marginBottom: '16px' }}>Access Denied</h1>
        <p style={{ color: 'var(--text-dim)' }}>Only authorized administrators can access the dashboard.</p>
      </div>
    );
  }

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const onPickFile = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const setStatus = (ok, msg) => setUploadStatus(s => ({ ...s, [type]: { ok, msg } }));

    if (type === 'image' && !file.type.startsWith('image/')) { setStatus(false, 'Not an image file'); showToast('Only images allowed'); return; }
    if (type === 'video' && !file.type.startsWith('video/')) { setStatus(false, 'Not a video file'); showToast('Only videos allowed'); return; }
    if (type === 'video' && file.size > 20 * 1024 * 1024) {
      const mb = (file.size / 1024 / 1024).toFixed(1);
      setStatus(false, `Video too large (${mb}MB) — 20MB max`);
      showToast('Video too big (Max 20MB)');
      return;
    }

    setUploading(type);
    setStatus(null, `Uploading ${file.name}…`);
    try {
      const { url } = await backend.uploadMedia(file);
      if (type === 'image') set({ thumbSrc: url });
      else set({ hoverSrc: url });
      setStatus(true, `Uploaded ${file.name}`);
      showToast(`${type} uploaded ✓`);
    } catch (err) {
      const detail = err?.message || (typeof err === 'string' ? err : 'Unknown error');
      setStatus(false, `Upload failed: ${detail}`);
      showToast('Upload failed: ' + detail);
    } finally {
      setUploading(null);
      if (type === 'image' && fileRef.current) fileRef.current.value = '';
      if (type === 'video' && videoRef.current) videoRef.current.value = '';
    }
  };

  const onAutofill = async () => {
    setAutofillError(null);
    if (!form.prompt || !form.prompt.trim()) {
      showToast('Paste the prompt/code first');
      setAutofillError('Paste the prompt first');
      return;
    }
    setAutofilling(true);
    try {
      // DEV: hit the local Vite proxy plugin (no Supabase deploy needed).
      // PROD: hit the deployed Supabase edge function.
      // To remove the local-dev path later, keep just the else-branch.
      let data, error;
      if (import.meta.env.DEV) {
        const resp = await fetch('/api/dev-autofill', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ prompt: form.prompt }),
        });
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) throw new Error(json?.error || `HTTP ${resp.status}`);
        data = json;
      } else {
        const invoked = await supabase.functions.invoke('autofill-metadata', {
          body: { prompt: form.prompt },
        });
        data = invoked.data;
        error = invoked.error;
        if (error) throw new Error(error.message || 'AI request failed');
      }
      if (!data?.metadata) throw new Error('No metadata returned');
      // AI response is strictly limited to metadata fields. Even so, whitelist
      // once more on the client before showing the preview.
      const clean = {};
      for (const k of AI_ALLOWED_FIELDS) if (k in data.metadata) clean[k] = data.metadata[k];
      setAutofillPreview({ suggestions: clean });
    } catch (err) {
      const msg = err.message || 'unknown';
      setAutofillError('AI failed: ' + msg);
      showToast('AI failed: ' + msg);
    } finally {
      setAutofilling(false);
    }
  };

  const applyAutofill = (pick) => {
    if (!autofillPreview) return;
    const patch = {};
    for (const f of AI_ALLOWED_FIELDS) {
      if (pick[f] && autofillPreview.suggestions[f] !== undefined) {
        patch[f] = autofillPreview.suggestions[f];
      }
    }
    setForm(f => ({ ...f, ...patch }));
    setAutofillPreview(null);
    showToast('Applied AI suggestions');
  };

  const onSubmit = async () => {
    setSaveError(null);
    if (!form.title) { showToast('Add a title'); setSaveError('Add a title'); return; }
    if (!form.category) { showToast('Pick a category'); setSaveError('Pick a category'); return; }
    if (!form.prompt) { showToast('Add the prompt'); setSaveError('Add the prompt'); return; }

    setSaving(true);
    const payload = { ...form, createdAt: isEditing ? undefined : new Date().toISOString() };
    try {
      // backend.create handles the "column missing" fallback internally —
      // it retries with a legacy-only payload if new columns aren't in the DB.
      await addDraft(payload);
      showToast(`Saved "${form.title}" (${form.status})`);
      cancelEdit();
    } catch (e) {
      const msg = e?.message || 'Unknown error';
      setSaveError('Failed to save: ' + msg);
      showToast('Failed to save: ' + msg);
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (item) => {
    setIsEditing(true);
    // Start from EMPTY_FORM so every field has a defined default; overlay item;
    // then explicitly coerce strings/arrays. Legacy seed items miss many of the
    // new fields (code / use_case / component_type / tags / stack / description).
    // Without this hydration React would warn about controlled inputs flipping
    // uncontrolled.
    setForm({
      ...EMPTY_FORM,
      ...item,
      tags: Array.isArray(item.tags) ? item.tags : [],
      stack: Array.isArray(item.stack) ? item.stack : [],
      title: item.title || '',
      category: item.category || '',
      description: item.description || '',
      use_case: item.use_case || '',
      code: item.code || '',
      prompt: item.prompt || '',
      link: item.link || '',
      thumbSrc: item.thumbSrc || item.thumb_src || '',
      hoverSrc: item.hoverSrc || item.hover_src || '',
      component_type: item.component_type || '',
      tier: item.tier || 'free',
      status: item.status || 'published',
    });
    setSaveError(null);
    setAutofillError(null);
    setUploadStatus({ image: null, video: null });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Editing: ${item.title}`);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setForm({ ...EMPTY_FORM, id: nextId(allPrompts) });
  };

  const onDelete = async (id) => {
    if (!window.confirm('Delete this resource?')) return;
    try {
      await removeDraft(id);
      showToast('Deleted');
    } catch {
      showToast('Failed to delete');
    }
  };

  const inputStyle = { width: '100%', padding: '12px 14px', background: '#0e0e10', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', fontFamily: 'var(--font-sans)', fontSize: '14px', outline: 'none' };
  const labelStyle = { display: 'block', marginBottom: '8px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 500 };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', fontFamily: 'var(--font-sans)', color: 'var(--text)' }}>
      {/* Nav */}
      <nav style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <a href="#/" style={{ background: 'transparent', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '3px', color: 'var(--text-dim)', textDecoration: 'none', fontSize: '12px' }}>← Library</a>
          <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '24px' }}>CUE</div>
          <span style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600 }}>ADMIN</span>
        </div>
        <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600 }}>
          {allPrompts.length} resources
        </div>
      </nav>

      {/* Header */}
      <header style={{ padding: '60px 24px 40px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: '64px', margin: '0 0 16px 0', letterSpacing: '-0.02em' }}>
          Manage <em style={{ fontStyle: 'italic' }}>Library</em>
        </h1>
        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '20px', color: 'var(--text-dim)', margin: 0 }}>
          Add a project &middot; Same card format &middot; <span style={{ color: 'var(--electric)' }}>saved globally</span>
        </p>
      </header>

      {/* Body Grid */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 24px 120px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '32px' }}>

        {/* Form Panel */}
        <div style={{ background: 'var(--card-bg)', padding: '32px', border: '1px solid var(--border)' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 400, fontStyle: 'italic', marginBottom: '6px' }}>{isEditing ? 'Edit resource' : 'Add new'}</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '28px', lineHeight: 1.5 }}>Paste the prompt first, then use <span style={{ color: 'var(--electric)' }}>✨ Auto-fill</span> to draft the metadata — you review before it applies.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Prompt FIRST — the source of truth for autofill */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Prompt / Code</label>
                <button
                  onClick={onAutofill}
                  disabled={autofilling || !form.prompt?.trim()}
                  style={{
                    padding: '6px 12px',
                    background: autofilling ? '#1c1c1e' : 'transparent',
                    color: form.prompt?.trim() ? 'var(--electric)' : 'var(--text-dimmer)',
                    border: `1px solid ${form.prompt?.trim() ? 'rgba(0,0,255,0.35)' : 'var(--border)'}`,
                    borderRadius: '3px',
                    fontSize: '11px',
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    cursor: form.prompt?.trim() && !autofilling ? 'pointer' : 'not-allowed',
                  }}
                >{autofilling ? 'Thinking…' : '✨ Auto-fill metadata'}</button>
              </div>
              <textarea value={form.prompt} onChange={e => set({ prompt: e.target.value })} rows={8} data-lenis-prevent style={{ ...inputStyle, fontFamily: 'Menlo, Consolas, monospace', fontSize: '12.5px', resize: 'vertical' }} className="admin-input" placeholder="Paste the AI prompt describing the component / effect…" />
              {autofillError && (
                <div style={{ marginTop: '8px', padding: '10px 12px', background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.28)', borderRadius: '4px', fontSize: '12px', color: 'var(--danger)', lineHeight: 1.45 }}>
                  <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '3px' }}>Autofill issue</div>
                  {autofillError}
                </div>
              )}
              <div style={{ fontSize: '10px', color: 'var(--text-dimmer)', marginTop: '6px', letterSpacing: '0.04em' }}>
                AI never modifies this field — it only reads it to suggest title, category, tags, description, stack, tier.
              </div>
            </div>

            {/* Component code — separate from the prompt */}
            <div>
              <label style={labelStyle}>Component Code <span style={{ textTransform: 'none', color: 'var(--text-dimmer)', letterSpacing: 0 }}>(the actual implementation, optional)</span></label>
              <textarea value={form.code} onChange={e => set({ code: e.target.value })} rows={8} data-lenis-prevent style={{ ...inputStyle, fontFamily: 'Menlo, Consolas, monospace', fontSize: '12.5px', resize: 'vertical' }} className="admin-input" placeholder="Paste the production-ready React/HTML/CSS/JS here…" />
              <div style={{ fontSize: '10px', color: 'var(--text-dimmer)', marginTop: '6px', letterSpacing: '0.04em' }}>
                Appears as the "Code" tab in the detail view. Leave empty to show only the prompt tab.
              </div>
            </div>

            {/* Title */}
            <div>
              <label style={labelStyle}>Title</label>
              <input type="text" value={form.title} onChange={e => set({ title: e.target.value })} placeholder="e.g. Curved Scroll Wheel" style={inputStyle} className="admin-input" />
            </div>

            {/* Category — dropdown + free-text (AI may propose a new one) */}
            <div>
              <label style={labelStyle}>Category</label>
              <input
                type="text"
                list="cue-category-suggestions"
                value={form.category}
                onChange={e => set({ category: e.target.value })}
                placeholder="Pick or type a category..."
                style={inputStyle}
                className="admin-input"
              />
              <datalist id="cue-category-suggestions">
                {CATEGORIES.map(c => <option key={c} value={c} />)}
                {form.category && !CATEGORIES.includes(form.category) && <option value={form.category} />}
              </datalist>
              {form.category && !CATEGORIES.includes(form.category) && (
                <div style={{ fontSize: '10px', color: 'var(--electric)', marginTop: '6px', letterSpacing: '0.04em' }}>
                  New category — will be added to the library.
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label style={labelStyle}>Description <span style={{ textTransform: 'none', color: 'var(--text-dimmer)', letterSpacing: 0 }}>(one line, ~15 words)</span></label>
              <input type="text" value={form.description} onChange={e => set({ description: e.target.value })} placeholder="What does it do? What's the feel?" style={inputStyle} className="admin-input" />
            </div>

            {/* Where to use it — Awwwards-juror-style recommendation */}
            <div>
              <label style={labelStyle}>Where to use <span style={{ textTransform: 'none', color: 'var(--text-dimmer)', letterSpacing: 0 }}>(one line — brand type + placement)</span></label>
              <input type="text" value={form.use_case} onChange={e => set({ use_case: e.target.value })} placeholder="e.g. Editorial hero on fashion / agency portfolios where the first scroll needs a cinematic pull" style={inputStyle} className="admin-input" />
            </div>

            {/* Tags */}
            <div>
              <label style={labelStyle}>Tags <span style={{ textTransform: 'none', color: 'var(--text-dimmer)', letterSpacing: 0 }}>(Enter or comma to add)</span></label>
              <ChipInput value={form.tags} onChange={tags => set({ tags })} placeholder="e.g. parallax, hero, gsap" />
            </div>

            {/* Stack */}
            <div>
              <label style={labelStyle}>Stack <span style={{ textTransform: 'none', color: 'var(--text-dimmer)', letterSpacing: 0 }}>(technologies used)</span></label>
              <ChipInput value={form.stack} onChange={stack => set({ stack })} placeholder="Pick from below or type a new one" suggestions={STACK_SUGGESTIONS} />
            </div>

            {/* Media */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Thumbnail (Opt)</label>
                <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={e => onPickFile(e, 'image')} />
                <button onClick={() => fileRef.current.click()} disabled={uploading === 'image'} style={{ width: '100%', padding: '12px', background: '#0e0e10', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', cursor: uploading === 'image' ? 'wait' : 'pointer' }}>{uploading === 'image' ? 'Uploading…' : form.thumbSrc ? 'Change Image' : 'Upload Image'}</button>
                <StatusLine status={uploadStatus.image} />
                {form.thumbSrc && (
                  <div style={{ marginTop: '8px' }}>
                    <div style={{ position: 'relative', aspectRatio: '16 / 10', background: '#0e0e10', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                      <img src={form.thumbSrc} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                    <div onClick={() => set({ thumbSrc: '' })} style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '6px', cursor: 'pointer' }}>Remove image</div>
                  </div>
                )}
              </div>
              <div>
                <label style={labelStyle}>Hover Video (Opt, ≤20MB)</label>
                <input type="file" ref={videoRef} style={{ display: 'none' }} onChange={e => onPickFile(e, 'video')} />
                <button onClick={() => videoRef.current.click()} disabled={uploading === 'video'} style={{ width: '100%', padding: '12px', background: '#0e0e10', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', cursor: uploading === 'video' ? 'wait' : 'pointer' }}>{uploading === 'video' ? 'Uploading…' : form.hoverSrc ? 'Change Video' : 'Upload Video'}</button>
                <StatusLine status={uploadStatus.video} />

                {/* OR paste a URL — for videos hosted elsewhere (Vimeo/CDN direct .mp4 links, Supabase URLs, etc.) */}
                <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                  <div style={{ fontSize: '9.5px', letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dimmer)' }}>OR</div>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
                </div>
                <input
                  type="url"
                  value={form.hoverSrc || ''}
                  onChange={e => {
                    set({ hoverSrc: e.target.value });
                    if (e.target.value) setUploadStatus(s => ({ ...s, video: { ok: true, msg: 'Using pasted URL' } }));
                    else setUploadStatus(s => ({ ...s, video: null }));
                  }}
                  placeholder="Paste a direct video URL (.mp4, .webm)…"
                  style={{ ...inputStyle, marginTop: '8px', fontSize: '12px' }}
                  className="admin-input"
                />

                {form.hoverSrc && (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ position: 'relative', aspectRatio: '16 / 10', background: '#0e0e10', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                      {/\.(jpe?g|gif|png|webp|svg|heic)$/i.test(form.hoverSrc) ? (
                        <img src={form.hoverSrc} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <video src={form.hoverSrc} controls muted playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', background: '#000' }} />
                      )}
                    </div>
                    <div onClick={() => { set({ hoverSrc: '' }); setUploadStatus(s => ({ ...s, video: null })); }} style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '6px', cursor: 'pointer' }}>Remove video</div>
                  </div>
                )}
              </div>
            </div>

            {/* Tier */}
            {/* Component type — powers the All / Sections / Interactions filter on the homepage */}
            <div>
              <label style={labelStyle}>Type <span style={{ textTransform: 'none', color: 'var(--text-dimmer)', letterSpacing: 0 }}>(where does it belong on the site)</span></label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div onClick={() => set({ component_type: 'section' })} style={{ cursor: 'pointer', padding: '14px 16px', border: `1px solid ${form.component_type === 'section' ? 'var(--electric)' : 'var(--border)'}`, borderRadius: '3px', background: form.component_type === 'section' ? 'rgba(0,0,255,0.06)' : '#0e0e10' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Section</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>Self-contained page piece — hero, nav, form, footer, gallery, pricing block</div>
                </div>
                <div onClick={() => set({ component_type: 'interaction' })} style={{ cursor: 'pointer', padding: '14px 16px', border: `1px solid ${form.component_type === 'interaction' ? 'var(--electric)' : 'var(--border)'}`, borderRadius: '3px', background: form.component_type === 'interaction' ? 'rgba(0,0,255,0.06)' : '#0e0e10' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Interaction</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>Smaller effect / animation / behavior — hover, cursor, scroll reveal, text anim</div>
                </div>
              </div>
              {!form.component_type && <div style={{ fontSize: '10.5px', color: 'var(--text-dimmer)', marginTop: '6px', letterSpacing: '0.04em' }}>Leave unset to let the homepage auto-classify from category keywords.</div>}
            </div>

            <div>
              <label style={labelStyle}>Access Tier</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div onClick={() => set({ tier: 'free' })} style={{ cursor: 'pointer', padding: '14px 16px', border: `1px solid ${form.tier === 'free' ? 'var(--electric)' : 'var(--border)'}`, borderRadius: '3px', background: form.tier === 'free' ? 'rgba(0,0,255,0.06)' : '#0e0e10' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Free</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>All users can view prompt</div>
                </div>
                <div onClick={() => set({ tier: 'paid' })} style={{ cursor: 'pointer', padding: '14px 16px', border: `1px solid ${form.tier === 'paid' ? 'var(--electric)' : 'var(--border)'}`, borderRadius: '3px', background: form.tier === 'paid' ? 'rgba(0,0,255,0.06)' : '#0e0e10' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Paid <span style={{ background: 'var(--electric)', padding: '2px 4px', borderRadius: '3px', fontSize: '9px', marginLeft: '4px' }}>Cue+</span></div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>Locked to subscribers</div>
                </div>
              </div>
            </div>

            {/* Status: Draft / Publish */}
            <div>
              <label style={labelStyle}>Status</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div onClick={() => set({ status: 'draft' })} style={{ cursor: 'pointer', padding: '12px 14px', border: `1px solid ${form.status === 'draft' ? 'var(--electric)' : 'var(--border)'}`, borderRadius: '3px', background: form.status === 'draft' ? 'rgba(0,0,255,0.06)' : '#0e0e10' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Draft</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>Not visible in library</div>
                </div>
                <div onClick={() => set({ status: 'published' })} style={{ cursor: 'pointer', padding: '12px 14px', border: `1px solid ${form.status === 'published' ? 'var(--electric)' : 'var(--border)'}`, borderRadius: '3px', background: form.status === 'published' ? 'rgba(0,0,255,0.06)' : '#0e0e10' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>Published</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>Live in library</div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button onClick={onSubmit} disabled={saving} style={{ flex: 1, padding: '14px', background: 'var(--electric)', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 24px -8px rgba(0,0,255,0.5)', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : isEditing ? 'Save changes' : 'Add to library'}</button>
              <button onClick={cancelEdit} style={{ padding: '14px', background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '14px', cursor: 'pointer' }}>{isEditing ? 'Cancel edit' : 'Clear'}</button>
            </div>

            {saveError && (
              <div style={{ marginTop: '12px', padding: '12px 14px', background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.28)', borderRadius: '4px', fontSize: '12.5px', color: 'var(--danger)', lineHeight: 1.5 }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700, marginBottom: '4px' }}>Save issue</div>
                {saveError}
              </div>
            )}
          </div>
        </div>

        {/* Live Preview */}
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 400, fontStyle: 'italic', marginBottom: '6px' }}>Preview</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '28px', lineHeight: 1.5 }}>This is exactly how it will appear in the library grid.</p>
          <div style={{ pointerEvents: 'none' }}>
            <EditorialCard item={{ ...form, isNew: true }} setSelectedItem={() => {}} />
          </div>
        </div>

      </div>

      {/* Uploaded List */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px 60px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 400, fontStyle: 'italic', marginBottom: '24px' }}>Uploaded resources</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {allPrompts.map(p => <ResourceRow key={p.id} p={p} isActive={isEditing && form.id === p.id} onEdit={beginEdit} onDelete={onDelete} />)}
        </div>
      </div>

      {/* Autofill preview modal */}
      {autofillPreview && (
        <AutofillPreview
          suggestions={autofillPreview.suggestions}
          current={form}
          onApply={applyAutofill}
          onCancel={() => setAutofillPreview(null)}
        />
      )}

    </div>
  );
}
