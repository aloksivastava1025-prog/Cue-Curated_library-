import React, { useRef, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { backend } from '../lib/backend.js';
import { useUser } from '@clerk/clerk-react';
import EditorialCard from '../components/EditorialCard.jsx';
import '../styles/overhaul.css';

const CATEGORIES = [
  'Text Animations', 'Visual Effects', 'Scroll Animations', 'Sliders & Marquees',
  'Page Transitions', 'Navigation', 'Loaders', 'Gallery & Images', 'Utilities & Scripts',
  'Sections & Layouts', 'Cursor Animations', 'Video & Audio', 'Buttons', 'Gimmicks',
  'Hover Interactions', 'Filters & Sorting', 'Forms', '3D & WebGL'
];

function nextId(existing) {
  let n = 1;
  const nums = existing.map((p) => parseInt(p.id.replace(/\\D/g, ''), 10)).filter((x) => !Number.isNaN(x));
  if (nums.length) n = Math.max(...nums) + 1;
  return `cue${String(n).padStart(3, '0')}`;
}

export default function Admin() {
  const { allPrompts, addDraft, removeDraft, showToast } = useApp();
  const { isLoaded, isSignedIn, user } = useUser();
  const fileRef = useRef(null);
  const videoRef = useRef(null);

  const [form, setForm] = useState(() => ({
    id: 'cue001',
    title: '',
    category: '',
    tier: 'free',
    thumbSrc: '',
    hoverSrc: '',
    prompt: '',
    link: ''
  }));

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);

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
    if (type === 'image' && !file.type.startsWith('image/')) { showToast('Only images allowed'); return; }
    if (type === 'video' && !file.type.startsWith('video/')) { showToast('Only videos allowed'); return; }
    if (type === 'video' && file.size > 4 * 1024 * 1024) { showToast('Video too big (Max 4MB)'); return; }
    
    setUploading(type);
    try {
      const { url } = await backend.uploadMedia(file);
      if (type === 'image') set({ thumbSrc: url });
      else set({ hoverSrc: url });
      showToast(`${type} uploaded ✓`);
    } catch (err) {
      showToast('Upload failed');
    } finally {
      setUploading(null);
      if (type === 'image' && fileRef.current) fileRef.current.value = '';
      if (type === 'video' && videoRef.current) videoRef.current.value = '';
    }
  };

  const onSubmit = async () => {
    if (!form.title) { showToast('Add a title'); return; }
    if (!form.category) { showToast('Pick a category'); return; }
    if (!form.prompt) { showToast('Add the prompt'); return; }

    setSaving(true);
    try {
      await addDraft({ ...form, status: 'published', createdAt: isEditing ? undefined : new Date().toISOString() });
      showToast(`Saved "${form.title}"`);
      cancelEdit();
    } catch (e) {
      showToast('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const beginEdit = (item) => {
    setIsEditing(true);
    setForm({ ...item });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast(`Editing: ${item.title}`);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setForm({
      id: nextId(allPrompts),
      title: '',
      category: '',
      tier: 'free',
      thumbSrc: '',
      hoverSrc: '',
      prompt: '',
      link: ''
    });
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
          <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '28px', lineHeight: 1.5 }}>Fill details below. The card preview updates instantly.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 500 }}>Title</label>
              <input type="text" value={form.title} onChange={e => set({title: e.target.value})} placeholder="e.g. Curved Scroll Wheel" style={{ width: '100%', padding: '12px 14px', background: '#0e0e10', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', fontFamily: 'var(--font-sans)', fontSize: '14px', outline: 'none' }} className="admin-input" />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 500 }}>Category</label>
              <select value={form.category} onChange={e => set({category: e.target.value})} style={{ width: '100%', padding: '12px 14px', background: '#0e0e10', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', fontFamily: 'var(--font-sans)', fontSize: '14px', outline: 'none' }} className="admin-input">
                <option value="" disabled>Select category...</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 500 }}>Thumbnail (Opt)</label>
                <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={e => onPickFile(e, 'image')} />
                <button onClick={() => fileRef.current.click()} style={{ width: '100%', padding: '12px', background: '#0e0e10', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer' }}>{uploading === 'image' ? 'Uploading...' : form.thumbSrc ? 'Change Image' : 'Upload Image'}</button>
                {form.thumbSrc && <div onClick={() => set({thumbSrc: ''})} style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '6px', cursor: 'pointer' }}>Remove image</div>}
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 500 }}>Hover Video (Opt)</label>
                <input type="file" ref={videoRef} style={{ display: 'none' }} onChange={e => onPickFile(e, 'video')} />
                <button onClick={() => videoRef.current.click()} style={{ width: '100%', padding: '12px', background: '#0e0e10', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer' }}>{uploading === 'video' ? 'Uploading...' : form.hoverSrc ? 'Change Video' : 'Upload Video'}</button>
                {form.hoverSrc && <div onClick={() => set({hoverSrc: ''})} style={{ fontSize: '11px', color: 'var(--danger)', marginTop: '6px', cursor: 'pointer' }}>Remove video</div>}
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 500 }}>Access Tier</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div onClick={() => set({tier: 'free'})} style={{ cursor: 'pointer', padding: '14px 16px', border: `1px solid ${form.tier === 'free' ? 'var(--electric)' : 'var(--border)'}`, borderRadius: '3px', background: form.tier === 'free' ? 'rgba(0,0,255,0.06)' : '#0e0e10' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Free</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>All users can view prompt</div>
                </div>
                <div onClick={() => set({tier: 'paid'})} style={{ cursor: 'pointer', padding: '14px 16px', border: `1px solid ${form.tier === 'paid' ? 'var(--electric)' : 'var(--border)'}`, borderRadius: '3px', background: form.tier === 'paid' ? 'rgba(0,0,255,0.06)' : '#0e0e10' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>Paid <span style={{ background: 'var(--electric)', padding: '2px 4px', borderRadius: '3px', fontSize: '9px', marginLeft: '4px' }}>Cue+</span></div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>Locked to subscribers</div>
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '8px', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 500 }}>Prompt / Code</label>
              <textarea value={form.prompt} onChange={e => set({prompt: e.target.value})} rows={8} style={{ width: '100%', padding: '12px 14px', background: '#0e0e10', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', fontFamily: 'Menlo, Consolas, monospace', fontSize: '12.5px', outline: 'none', resize: 'vertical' }} className="admin-input" />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button onClick={onSubmit} disabled={saving} style={{ flex: 1, padding: '14px', background: 'var(--electric)', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 24px -8px rgba(0,0,255,0.5)', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : isEditing ? 'Save changes' : 'Add to library'}</button>
              <button onClick={cancelEdit} style={{ padding: '14px', background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '14px', cursor: 'pointer' }}>{isEditing ? 'Cancel edit' : 'Clear'}</button>
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontWeight: 400, fontStyle: 'italic', marginBottom: '6px' }}>Preview</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-dim)', marginBottom: '28px', lineHeight: 1.5 }}>This is exactly how it will appear in the library grid.</p>
          <div style={{ pointerEvents: 'none' }}>
            <EditorialCard item={{ ...form, isNew: true, brandStyle: { fontFamily: 'var(--font-sans)', fontSize: '28px', fontWeight: 600 } }} setSelectedItem={() => {}} />
          </div>
        </div>

      </div>

      {/* Uploaded List */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px 60px' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 400, fontStyle: 'italic', marginBottom: '24px' }}>Uploaded resources</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {allPrompts.map(p => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto auto', gap: '16px', padding: '14px 18px', alignItems: 'center', background: 'var(--card-bg)', border: `1px solid ${isEditing && form.id === p.id ? 'var(--electric)' : 'var(--border)'}`, borderRadius: '3px' }}>
              <div style={{ width: '80px', height: '50px', background: 'var(--card-img-bg)', borderRadius: '2px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.thumbSrc ? <img src={p.thumbSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '22px' }}>{p.title.charAt(0)}</span>}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {p.title} {(p.tier === 'paid' || p.price === 'premium') && <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(0,0,255,0.15)', color: 'var(--electric)', border: '1px solid rgba(0,0,255,0.4)', borderRadius: '3px' }}>🔒 Cue+</span>}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>{p.category}</div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-dimmer)' }}>
                {new Date(p.createdAt || Date.now()).toLocaleDateString()}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => beginEdit(p)} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--electric)', border: '1px solid rgba(0,0,255,0.35)', borderRadius: '3px', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer' }}>Edit</button>
                <button onClick={() => onDelete(p.id)} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--danger)', border: '1px solid rgba(255,77,77,0.25)', borderRadius: '3px', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
