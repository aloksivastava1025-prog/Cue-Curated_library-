import React, { useEffect, useState } from 'react';
import { backend } from '../lib/backend.js';

export default function Modal({ item, onClose }) {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Use localStorage to determine tier if we aren't heavily relying on Clerk for tier.
  // The spec says: "The design is NEVER locked — only the prompt. Free users see all thumbnails, videos, hover previews."
  const [userTier, setUserTier] = useState(localStorage.getItem('cue_user_tier') || 'free');

  useEffect(() => {
    const handleTierChange = () => {
      setUserTier(localStorage.getItem('cue_user_tier') || 'free');
    };
    window.addEventListener('storage', handleTierChange);
    return () => window.removeEventListener('storage', handleTierChange);
  }, []);

  useEffect(() => {
    if (!item) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [item, onClose]);

  useEffect(() => {
    if (!item) {
      setContent(null);
      return;
    }
    if (item.prompt && item.tier !== 'paid' && item.price !== 'premium') {
      setContent(item.prompt);
      return;
    }

    let active = true;
    setLoading(true);
    backend.getPromptContent(item.id).then(text => {
      if (active) {
        setContent(text);
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [item]);

  if (!item) return null;

  const isPaid = item.tier === 'paid' || item.price === 'premium';
  const promptLocked = isPaid && userTier === 'free';

  const onUpgrade = () => {
    localStorage.setItem('cue_user_tier', 'paid');
    window.location.reload();
  };

  const onCopy = async () => {
    const textToCopy = content || item.prompt || '';
    if (textToCopy) {
      await navigator.clipboard.writeText(textToCopy);
      const btn = document.getElementById('copyBtn');
      if(btn) {
        btn.textContent = 'Copied ✓';
        setTimeout(() => {
          btn.textContent = 'Copy prompt';
        }, 1500);
      }
    }
  };

  const escapeHtml = (s) => {
    return (s || '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'})[c]);
  };

  return (
    <div className={`modal is-open`} id="modal" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '24px 32px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: '22px', fontStyle: 'italic', marginBottom: '4px' }}>
              {item.title}
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-dim)', fontWeight: 600 }}>
              {item.category}
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text)', fontSize: '24px', cursor: 'pointer' }} aria-label="Close">×</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }} className="custom-scrollbar">
          {/* Design preview at top */}
          <div style={{ position: 'relative', aspectRatio: '16/10', background: 'var(--card-img-bg)' }}>
            {item.thumbSrc ? (
              <img src={item.thumbSrc} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} alt={item.title} />
            ) : (
               <div className="cover-placeholder" style={{ position: 'static', height: '100%' }}><span>{item.title}</span></div>
            )}
            {item.hoverSrc && !item.hoverSrc.match(/\.(jpeg|jpg|gif|png|webp|svg|heic)$/i) && (
              <video src={item.hoverSrc} muted loop autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 2 }}></video>
            )}
          </div>

          <div style={{ padding: '32px' }}>
            {promptLocked ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', border: '1px solid var(--border)', background: '#0a0a0c', borderRadius: '3px' }}>
                <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(0,0,255,0.15)', border: '1px solid rgba(0,0,255,0.4)', color: 'var(--electric)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 16px' }}>🔒</div>
                <div style={{ fontFamily: 'var(--font-serif)', fontSize: '28px', fontStyle: 'italic', color: 'var(--text)', marginBottom: '12px' }}>Prompt locked for <em style={{ color: 'var(--electric)', fontStyle: 'italic' }}>Cue+</em></div>
                <div style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', color: 'var(--text-dim)', maxWidth: '420px', margin: '0 auto 24px', lineHeight: 1.5 }}>You can browse the design freely. To copy the paste-ready prompt into Bolt, v0 or Cursor, upgrade to Cue+.</div>
                
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button onClick={onClose} style={{ padding: '12px 24px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: '3px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Not now</button>
                  <button onClick={onUpgrade} style={{ padding: '12px 24px', background: 'var(--electric)', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', boxShadow: '0 4px 16px -4px rgba(0,0,255,0.6)', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>Upgrade to Cue+</button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '12px' }}>Paste-ready prompt</div>
                <pre style={{ background: '#050505', border: '1px solid var(--border)', padding: '18px 20px', fontFamily: 'Menlo, Consolas, monospace', fontSize: '12.5px', lineHeight: 1.6, color: '#e8e8e2', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '36vh', overflowY: 'auto' }} className="custom-scrollbar" dangerouslySetInnerHTML={{__html: escapeHtml(content || item.prompt || 'Loading...')}}></pre>
                
                <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
                  <button onClick={onClose} style={{ padding: '12px 24px', background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-dim)', borderRadius: '3px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}>Close</button>
                  <button id="copyBtn" onClick={onCopy} style={{ padding: '12px 24px', background: 'var(--electric)', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer', boxShadow: '0 4px 16px -4px rgba(0,0,255,0.6)', fontWeight: 600, fontFamily: 'var(--font-sans)' }}>Copy prompt</button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
