import React, { useEffect, useState } from 'react';
import { copyToClipboard } from '../hooks/useClipboard.js';
import { backend } from '../lib/backend.js';
import { useClerk, useUser } from '@clerk/clerk-react';

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: '20px', height: '20px' }}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: '24px', height: '24px', margin: '0 auto 12px', color: 'var(--text-dim)', display: 'block' }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
      <path d="M7 11V7a5 5 0 0110 0v4"></path>
    </svg>
  );
}

export default function Modal({ item, onClose, showToast }) {
  const { user, isSignedIn } = useUser();
  const clerk = useClerk();
  
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

  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item) {
      setContent(null);
      return;
    }
    // If the prompt is stored directly (like from localStorage/drafts)
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

  const isPremium = item.tier === 'paid' || item.price === 'premium';
  const isLocked = isPremium && !content && !loading;

  const onPurchase = async () => {
    if (!isSignedIn) {
      if (showToast) showToast('Please sign in to continue purchase');
      clerk.openSignIn({ redirectUrl: window.location.href });
      return;
    }
    if (showToast) showToast('Redirecting to secure checkout...');
    try {
      const customerEmail = user?.primaryEmailAddress?.emailAddress || '';
      const customerName = user?.fullName || user?.firstName || '';
      const url = await backend.createCheckoutSession(item.id, customerEmail, customerName);
      window.location.href = url;
    } catch (err) {
      if (showToast) showToast('Checkout failed: ' + err.message);
    }
  };

  const onCopy = async () => {
    if (isPremium && isLocked) {
      if(showToast) showToast('Premium prompt — purchase to unlock');
      return;
    }
    const ok = await copyToClipboard(content || item.prompt || '');
    if (ok && showToast) showToast(`Copied “${item.title}”`);
    else if (showToast) showToast('Copy failed. Try again.');
  };
  
  const hash = item.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', padding: '20px' }} onClick={onClose}>
      
      {/* Close Button Top Right */}
      <button onClick={onClose} style={{ position: 'absolute', top: '24px', right: '24px', background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '8px', zIndex: 1010 }}>
        <CloseIcon />
      </button>

      {/* Modal Panel */}
      <div 
        onClick={e => e.stopPropagation()} 
        style={{ width: '100%', maxWidth: '820px', maxHeight: '90vh', background: 'var(--card-bg)', overflowY: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '0 40px 100px rgba(0,0,0,0.8)' }}
        className="custom-scrollbar"
      >
        {/* Media Preview (16/10) */}
        <div style={{ position: 'relative', aspectRatio: '16 / 10', background: 'var(--card-img-bg)', overflow: 'hidden' }}>
          {item.hoverSrc ? (
            item.hoverSrc.match(/\.(jpeg|jpg|gif|png|webp|svg|heic)$/i) ? (
              <img src={item.hoverSrc} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <video src={item.hoverSrc} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            )
          ) : item.thumbSrc ? (
            <img src={item.thumbSrc} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 30% 30%, hsla(${hue}, 60%, 25%, 0.4) 0%, transparent 60%)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontFamily: 'var(--font-serif)', fontSize: '40px', fontStyle: 'italic', color: 'var(--text)' }}>{item.title}</span>
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div style={{ padding: '32px 40px' }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '32px', fontWeight: 400, fontStyle: 'italic', letterSpacing: '-0.015em', marginBottom: '8px', color: '#fff' }}>
            {item.title}
          </h2>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '32px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600 }}>{item.category}</span>
            {(item.stack || []).map(s => (
              <span key={s} style={{ fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600 }}>&middot; {s}</span>
            ))}
          </div>

          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-dim)' }}>Loading...</div>
          ) : isLocked ? (
            <div style={{ border: '1px solid var(--border)', padding: '40px 20px', textAlign: 'center', background: '#111' }}>
              <LockIcon />
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '24px', fontStyle: 'italic', fontWeight: 400, marginBottom: '24px', color: '#fff' }}>Prompt locked for Cue+</h3>
              <button onClick={onPurchase} style={{ padding: '14px 28px', background: 'var(--electric)', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 24px -8px rgba(0,0,255,0.6)' }}>
                Upgrade to Cue+
              </button>
            </div>
          ) : (
            <div>
              <div style={{ background: '#0e0e10', border: '1px solid var(--border)', padding: '24px', overflowX: 'auto', marginBottom: '24px' }} className="custom-scrollbar">
                <pre style={{ margin: 0, padding: 0, fontFamily: 'Menlo, Consolas, monospace', fontSize: '13px', lineHeight: 1.6, color: 'var(--text-dim)' }}>
                  {content || item.prompt || 'No prompt available.'}
                </pre>
              </div>
              <button onClick={onCopy} style={{ display: 'block', width: '100%', padding: '16px', background: 'var(--electric)', color: '#fff', border: 'none', borderRadius: '3px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 24px -8px rgba(0,0,255,0.6)', transition: 'transform 0.2s ease' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
                Copy prompt
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
