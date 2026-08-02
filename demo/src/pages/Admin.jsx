import React, { useRef, useState, useEffect } from 'react';
import { useApp } from '../context/AppContext.jsx';
import { backend } from '../lib/backend.js';
import EditorialCard from '../components/EditorialCard.jsx';

const CATEGORIES = [
  'Text Animations', 'Visual Effects', 'Scroll Animations', 'Sliders & Marquees',
  'Page Transitions', 'Navigation', 'Loaders', 'Gallery & Images', 'Utilities & Scripts',
  'Sections & Layouts', 'Cursor Animations', 'Video & Audio', 'Buttons', 'Gimmicks',
  'Hover Interactions', 'Filters & Sorting', 'Forms', '3D & WebGL', 'Other'
];

const CustomSelect = ({ value, onChange, options, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);
  
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);
  
  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          width: '100%', padding: '12px 14px', background: '#0e0e10', color: value ? 'var(--text)' : 'var(--text-dim)', 
          border: `1px solid ${isOpen ? 'var(--electric)' : 'var(--border)'}`, borderRadius: '3px', 
          fontFamily: 'var(--font-sans)', fontSize: '14px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          transition: 'all 0.2s ease'
        }}
      >
        {value || placeholder}
        <span style={{ fontSize: '10px', color: 'var(--text-dim)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>▼</span>
      </div>
      
      {isOpen && (
        <div 
          className="custom-scrollbar"
          style={{ 
            position: 'absolute', top: '100%', left: 0, right: 0, marginTop: '8px', background: '#1c1c1e', 
            border: '1px solid var(--border)', borderRadius: '3px', zIndex: 100, maxHeight: '240px', overflowY: 'auto',
            boxShadow: '0 8px 32px rgba(0,0,0,0.5)', animation: 'fadeIn 0.2s ease'
          }}
        >
          {options.map(opt => (
            <div 
              key={opt}
              onClick={() => { onChange(opt); setIsOpen(false); }}
              onMouseEnter={(e) => { e.target.style.background = 'rgba(0,0,255,0.1)'; e.target.style.color = 'var(--electric)'; }}
              onMouseLeave={(e) => { e.target.style.background = 'transparent'; e.target.style.color = 'var(--text)'; }}
              style={{ padding: '10px 14px', cursor: 'pointer', fontSize: '13px', color: 'var(--text)', transition: 'all 0.15s ease', borderBottom: '1px solid rgba(255,255,255,0.02)' }}
            >
              {opt}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default function Admin() {
  const { allPrompts, addDraft, removeDraft } = useApp();
  const fileRef = useRef(null);
  const videoRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const [form, setForm] = useState({
    title: '', category: '', customCategory: '', description: '', componentType: 'interactions', tier: 'free', price: '', thumbSrc: '', hoverSrc: '', prompt: '', link: ''
  });

  const showToastMsg = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const onPickFile = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (type === 'video' && file.size > 4 * 1024 * 1024) { showToastMsg('Video too big · use URL instead'); return; }
    
    // For this rewrite we fall back to FileReader if backend isn't ready or just use FileReader as requested by the prompt
    // "Upload converts to base64 via FileReader"
    const reader = new FileReader();
    reader.onload = () => {
      if (type === 'image') set({ thumbSrc: reader.result });
      else set({ hoverSrc: reader.result });
      showToastMsg(`${type === 'image' ? 'Image' : 'Video'} attached ✓`);
    };
    reader.readAsDataURL(file);
  };

  const onSubmit = async () => {
    if (!form.title) { showToastMsg('Add a title'); return; }
    if (!form.category) { showToastMsg('Pick a category'); return; }
    if (form.category === 'Other' && !form.customCategory) { showToastMsg('Enter custom category'); return; }
    if (!form.prompt) { showToastMsg('Add the prompt / code'); return; }

    try {
      const finalCategory = form.category === 'Other' ? form.customCategory.toLowerCase() : form.category;
      const payload = { ...form, category: finalCategory, status: 'published' };
      delete payload.customCategory; // remove internal state field
      
      if (editingId) payload.id = editingId;
      else payload.createdAt = new Date().toISOString();
      
      await addDraft(payload);
      showToastMsg(`Saved changes`);
      cancelEdit();
    } catch (e) {
      showToastMsg('Failed to save');
    }
  };

  const beginEdit = (item) => {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      category: CATEGORIES.includes(item.category) ? item.category : 'Other',
      customCategory: CATEGORIES.includes(item.category) ? '' : (item.category || ''),
      description: item.description || '',
      componentType: item.componentType || 'interactions',
      tier: item.tier || 'free',
      price: item.price || '',
      thumbSrc: item.thumbSrc || '',
      hoverSrc: item.hoverSrc || '',
      prompt: item.prompt || '',
      link: item.link || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToastMsg(`Editing: ${item.title}`);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm({ title: '', category: '', customCategory: '', description: '', componentType: 'interactions', tier: 'free', price: '', thumbSrc: '', hoverSrc: '', prompt: '', link: '' });
  };

  const onDelete = async (id) => {
    try {
      await removeDraft(id);
      showToastMsg('Deleted');
    } catch {
      showToastMsg('Failed to delete');
    }
  };

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      
      {/* Nav bar */}
      <nav style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button onClick={() => window.location.hash = ''} style={{ background: 'transparent', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '3px', color: 'var(--text)', cursor: 'pointer', fontSize: '12px', fontFamily: 'var(--font-sans)' }}>← Library</button>
          <div style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '24px', color: 'var(--text)' }}>CUE</div>
          <span style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600 }}>ADMIN</span>
        </div>
        <div style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600 }}>
          {allPrompts.length} resources
        </div>
      </nav>

      {/* Header */}
      <header style={{ padding: '60px 24px 40px', maxWidth: '1200px', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontWeight: 300, fontSize: '64px', margin: '0 0 16px 0', letterSpacing: '-0.02em', color: 'var(--text)' }}>
          Manage <em style={{ fontStyle: 'italic' }}>Library</em>
        </h1>
        <p style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '20px', color: 'var(--text-dim)', margin: 0 }}>
          Add a project &middot; Same card format &middot; <strong style={{ color: 'var(--electric)', fontWeight: 'normal' }}>saved globally</strong>
        </p>
      </header>

      {/* Body Grid */}
      <div className="admin-body">
        
        {/* Form Panel */}
        <div className="panel">
          <h2 className="panel-title">{editingId ? 'Edit resource' : 'Add new'}</h2>
          <p className="panel-desc">Fill details below. The card preview updates instantly.</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="field">
              <label>Title</label>
              <input type="text" value={form.title} onChange={e => set({title: e.target.value})} placeholder="e.g. Curved Scroll Wheel" />
            </div>

            <div className="field">
              <label>Category</label>
              <CustomSelect 
                value={form.category} 
                onChange={(val) => set({ category: val })} 
                options={CATEGORIES} 
                placeholder="Select category..." 
              />
            </div>

            {form.category === 'Other' && (
              <div className="field" style={{ animation: 'fadeIn 0.3s ease' }}>
                <label>Custom Category</label>
                <input type="text" value={form.customCategory} onChange={e => set({customCategory: e.target.value.toLowerCase()})} placeholder="e.g. typography" />
              </div>
            )}

            <div className="field">
              <label>Component Type</label>
              <div className="tier-toggle">
                <label className="tier-option">
                  <input type="radio" name="componentType" value="interactions" checked={form.componentType === 'interactions'} onChange={() => set({componentType: 'interactions'})} />
                  <span className="tier-label" style={{ display: 'block' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', display: 'block' }}>Interactions</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>Buttons, navbars, micro-interactions</span>
                  </span>
                </label>
                <label className="tier-option">
                  <input type="radio" name="componentType" value="sections" checked={form.componentType === 'sections'} onChange={() => set({componentType: 'sections'})} />
                  <span className="tier-label" style={{ display: 'block' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', display: 'block' }}>Sections</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>Landing pages, hero sections, layouts</span>
                  </span>
                </label>
              </div>
            </div>

            <div className="field">
              <label>Description</label>
              <textarea value={form.description} onChange={e => set({description: e.target.value})} rows={3} placeholder="Brief description of the component..." style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="field">
              <div>
                <label>Thumbnail (optional — auto-generated if empty)</label>
                <input type="file" ref={fileRef} style={{ display: 'none' }} onChange={e => onPickFile(e, 'image')} />
                <button onClick={() => fileRef.current.click()} style={{ width: '100%', padding: '12px', background: '#0e0e10', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{form.thumbSrc ? 'Change Image' : 'Upload Image'}</button>
                <div className="field-hint">empty = auto gradient with title</div>
              </div>
              <div>
                <label>Hover Video</label>
                <input type="file" ref={videoRef} style={{ display: 'none' }} onChange={e => onPickFile(e, 'video')} />
                <button onClick={() => videoRef.current.click()} style={{ width: '100%', padding: '12px', background: '#0e0e10', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '3px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>{form.hoverSrc ? 'Change Video' : 'Upload Video'}</button>
                <div className="field-hint">Warn if file &gt; 4MB</div>
              </div>
            </div>

            <div className="field">
              <label>Access Tier</label>
              <div className="tier-toggle">
                <label className="tier-option">
                  <input type="radio" name="tier" value="free" checked={form.tier === 'free'} onChange={() => set({tier: 'free'})} />
                  <span className="tier-label" style={{ display: 'block' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', display: 'block' }}>Free</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>All users can view the prompt</span>
                  </span>
                </label>
                <label className="tier-option">
                  <input type="radio" name="tier" value="paid" checked={form.tier === 'paid'} onChange={() => set({tier: 'paid'})} />
                  <span className="tier-label" style={{ display: 'block' }}>
                    <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', display: 'block' }}>Paid <span style={{ background: 'var(--electric)', color: '#fff', padding: '2px 4px', borderRadius: '3px', fontSize: '9px', marginLeft: '4px' }}>Cue+</span></span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px', display: 'block' }}>Locked to paid subscribers</span>
                  </span>
                </label>
              </div>
            </div>

            {form.tier === 'paid' && (
              <div className="field" style={{ animation: 'fadeIn 0.3s ease' }}>
                <label>Price (USD)</label>
                <input type="number" step="0.01" value={form.price} onChange={e => set({price: e.target.value})} placeholder="e.g. 19.99" />
              </div>
            )}

            <div className="field">
              <label>Prompt / Code</label>
              <textarea value={form.prompt} onChange={e => set({prompt: e.target.value})} rows={8} style={{ minHeight: '140px', fontFamily: 'Menlo, Consolas, monospace', fontSize: '12.5px', resize: 'vertical' }} />
            </div>
            
            <div className="field">
              <label>Link (Optional)</label>
              <input type="text" value={form.link} onChange={e => set({link: e.target.value})} placeholder="https://..." />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button onClick={onSubmit} style={{ flex: 1, padding: '14px', background: 'var(--electric)', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 24px -8px rgba(0,0,255,0.5)' }}>{editingId ? 'Save changes' : 'Add to library'}</button>
              <button onClick={(e) => { e.preventDefault(); cancelEdit(); }} style={{ padding: '14px', background: 'transparent', color: 'var(--text-dim)', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '14px', cursor: 'pointer' }}>{editingId ? 'Cancel edit' : 'Clear'}</button>
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div>
          <h2 className="panel-title">Preview</h2>
          <p className="panel-desc">This is exactly how it will appear in the library grid.</p>
          <div style={{ pointerEvents: 'none' }}>
            {(!form.title && !form.category && !form.thumbSrc) ? (
              <div style={{ padding: '40px', border: '1px dashed var(--border)', textAlign: 'center', color: 'var(--text-dim)', fontSize: '14px' }}>Fill the form to preview &rarr;</div>
            ) : (
              <EditorialCard item={{ ...form, isNew: true, createdAt: new Date().toISOString() }} onClick={() => {}} />
            )}
          </div>
        </div>

      </div>

      {/* Uploaded List */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontWeight: 400, fontStyle: 'italic', color: 'var(--text)', margin: 0 }}>Uploaded resources</h2>
          <span style={{ fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>{allPrompts.length} resources</span>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {allPrompts.map(p => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto auto', gap: '16px', padding: '14px 18px', alignItems: 'center', background: editingId === p.id ? 'rgba(0,0,255,0.04)' : 'var(--card-bg)', border: `1px solid ${editingId === p.id ? 'var(--electric)' : 'var(--border)'}`, borderRadius: '3px' }}>
              
              <div style={{ width: '80px', height: '50px', background: 'var(--card-img-bg)', borderRadius: '2px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {p.thumbSrc ? (
                  <img src={p.thumbSrc} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={p.title} />
                ) : (
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1a1a1c 0%, #0d0d10 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: '22px', color: 'var(--text)' }}>{(p.title || 'A').charAt(0)}</span>
                  </div>
                )}
              </div>
              
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {p.title} 
                  {(p.tier === 'paid' || p.price === 'premium') && <span style={{ fontSize: '9px', padding: '2px 6px', background: 'rgba(0,0,255,0.15)', color: 'var(--electric)', border: '1px solid rgba(0,0,255,0.4)', borderRadius: '3px' }}>🔒 Cue+</span>}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>{p.category} &middot; {p.prompt ? p.prompt.length : 0} chars</div>
              </div>
              
              <div style={{ fontSize: '12px', color: 'var(--text-dimmer)' }}>
                {p.createdAt ? new Date(p.createdAt).toLocaleDateString() : 'today'}
              </div>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => beginEdit(p)} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--electric)', border: '1px solid rgba(0,0,255,0.35)', borderRadius: '3px', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer' }}>Edit</button>
                <button onClick={() => onDelete(p.id)} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--danger)', border: '1px solid rgba(255,77,77,0.25)', borderRadius: '3px', fontSize: '11px', textTransform: 'uppercase', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {toast && (
        <div className="toast is-show">{toast}</div>
      )}

    </div>
  );
}
