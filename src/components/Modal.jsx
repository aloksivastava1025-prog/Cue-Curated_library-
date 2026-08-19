import React, { useEffect, useMemo, useState } from 'react';
import { copyToClipboard } from '../hooks/useClipboard.js';
import { backend } from '../lib/backend.js';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { isPremium as isPremiumItem, primaryCategory as primaryCategoryOf } from '../lib/promptHelpers.js';

function formatCount(n) {
  const x = Number(n) || 0;
  if (x >= 1e6) return (x / 1e6).toFixed(x >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'm';
  if (x >= 1e3) return (x / 1e3).toFixed(x >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(x);
}

const modalActionBtn = (active, color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '6px 12px', borderRadius: 999,
  background: active ? 'rgba(0,0,255,0.06)' : 'transparent',
  border: '1px solid ' + (active ? color : 'var(--border)'),
  color,
  fontFamily: 'var(--font-sans)',
  fontSize: 12, fontWeight: 500, letterSpacing: '0.02em',
  cursor: 'pointer',
  transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
});

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function LockIcon({ size = 26 }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: size, height: size }}>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0110 0v4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}>
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

const isImage = (src) => !!src && /\.(jpeg|jpg|gif|png|webp|svg|heic)$/i.test(src);

export default function Modal({ item, onClose, showToast }) {
  const { user, isSignedIn } = useUser();
  const clerk = useClerk();
  const { openAuth } = useAuth();
  const { bookmarkedIds, likedIds, toggleBookmark, toggleLike, registerView } = useApp();
  const isBookmarked = bookmarkedIds?.has(item?.id);
  const isLiked = likedIds?.has(item?.id);
  const [likeAnim, setLikeAnim] = useState(false);

  const [content, setContent] = useState(null); // prompt content (may load async)
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('code'); // 'code' | 'prompt'
  const [copied, setCopied] = useState(null); // 'code' | 'prompt' | null

  // Register a view once per modal open (per item). Fires optimistically —
  // failures don't affect the UI.
  useEffect(() => {
    if (item?.id) registerView(item.id);
  }, [item?.id, registerView]);

  // Close on Esc, lock body scroll while open.
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

  const isPremium = isPremiumItem(item);

  // Fetch full prompt content for free items on open; premium stays locked.
  useEffect(() => {
    if (!item) { setContent(null); return; }
    if (isPremium) { setContent(null); return; }
    if (item.prompt) { setContent(item.prompt); return; }
    let active = true;
    setLoading(true);
    backend.getPromptContent(item.id)
      .then((text) => { if (active) { setContent(text); setLoading(false); } })
      .catch(() => { if (active) { setContent(null); setLoading(false); } });
    return () => { active = false; };
  }, [item, isPremium]);

  // Which tabs exist? Auto-select the first non-empty one when the item changes.
  const hasCode = !!(item && item.code && item.code.trim());
  const hasPrompt = !!(item && (item.prompt || content));
  const hasUseCase = !!(item && item.use_case && item.use_case.trim());

  useEffect(() => {
    if (!item) return;
    setTab(hasCode ? 'code' : hasPrompt ? 'prompt' : 'use_case');
    setCopied(null);
  }, [item?.id, hasCode, hasPrompt]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!item) return null;

  const onCopy = async (which) => {
    // Even free prompts require sign-in. Free = lead capture, not free-for-all
    // — signup emails are the strongest signal for a beta.
    if (!isSignedIn) {
      if (showToast) showToast('Sign in to copy — takes 10 seconds');
      openAuth('sign-in');
      return;
    }
    let text = '';
    if (which === 'code') text = item.code || '';
    else if (which === 'prompt') text = content || item.prompt || '';
    else if (which === 'use_case') text = item.use_case || '';
    if (!text) {
      if (showToast) showToast('Nothing to copy');
      return;
    }
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(which);
      setTimeout(() => setCopied((c) => (c === which ? null : c)), 1600);
      if (showToast) showToast(`Copied ${which.replace('_', ' ')}`);
    } else if (showToast) {
      showToast('Copy failed');
    }
  };

  const onBuyIndividual = async () => {
    if (!isSignedIn) {
      if (showToast) showToast('Sign in to purchase');
      openAuth('sign-in');
      return;
    }
    if (showToast) showToast('Opening secure checkout…');
    try {
      const email = user?.primaryEmailAddress?.emailAddress || '';
      const name = user?.fullName || user?.firstName || '';
      const url = await backend.createCheckoutSession(item.id, email, name);
      window.location.href = url;
    } catch (err) {
      if (showToast) showToast('Checkout failed: ' + err.message);
    }
  };

  const onSubscribe = () => {
    // Route to the site's pricing surface; tests + edge-fn subscription flow live there.
    window.location.hash = '#/pricing';
    onClose();
  };

  // --- Media (left column) ---------------------------------------------------
  const media = item.hoverSrc
    ? (isImage(item.hoverSrc)
        ? <img src={item.hoverSrc} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
        : <video src={item.hoverSrc} autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />)
    : item.thumbSrc
      ? <img src={item.thumbSrc} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }} />
      : (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'linear-gradient(135deg, #1a1a1c 0%, #0d0d10 100%)' }}>
          <span style={{ fontFamily: 'var(--font-serif)', fontStyle: 'italic', fontSize: 32, color: 'var(--text)' }}>{item.title}</span>
        </div>
      );

  const primaryCategory = primaryCategoryOf(item);

  // Backdrop click closes.
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 1100, maxHeight: '90vh',
          background: 'var(--card-bg)',
          borderRadius: 14,
          overflow: 'hidden',
          display: 'flex',
          boxShadow: '0 40px 100px rgba(0,0,0,0.8)',
          position: 'relative',
        }}
        className="cue-detail-modal"
      >
        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute', top: 14, right: 14, zIndex: 5,
            width: 32, height: 32, borderRadius: 999,
            background: 'rgba(0,0,0,0.55)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <CloseIcon />
        </button>

        {/* LEFT: Media */}
        <div className="cue-detail-media" style={{ flex: '1 1 55%', background: '#000', position: 'relative', minHeight: 300 }}>
          {media}
        </div>

        {/* RIGHT: Meta + tabs */}
        <div
          className="cue-detail-side custom-scrollbar"
          data-lenis-prevent
          style={{
            flex: '1 1 45%',
            display: 'flex', flexDirection: 'column',
            padding: '28px 28px 24px',
            overflowY: 'auto',
            borderLeft: '1px solid var(--border)',
            background: 'var(--card-bg)',
          }}
        >
          {/* Header meta */}
          <div style={{ marginBottom: 20 }}>
            {primaryCategory && (
              <div style={{ fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 12 }}>
                {primaryCategory}
              </div>
            )}
            <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 400, fontStyle: 'italic', letterSpacing: '-0.015em', margin: 0, color: '#fff', lineHeight: 1.15 }}>
              {item.title}
            </h2>
            {item.description && (
              <p style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.55, color: 'var(--text-dim)' }}>{item.description}</p>
            )}
            {/* Tags + stack — pills, no dump */}
            {(Array.isArray(item.tags) && item.tags.length > 0 || Array.isArray(item.stack) && item.stack.length > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                {(item.tags || []).slice(0, 6).map((t) => (
                  <span key={`t-${t}`} style={{ padding: '3px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', color: 'var(--text-dim)', fontSize: 10.5, letterSpacing: '0.04em', textTransform: 'lowercase' }}>{t}</span>
                ))}
                {(item.stack || []).slice(0, 4).map((s) => (
                  <span key={`s-${s}`} style={{ padding: '3px 9px', borderRadius: 999, background: 'rgba(0,0,255,0.08)', border: '1px solid rgba(0,0,255,0.22)', color: 'var(--text)', fontSize: 10.5, letterSpacing: '0.04em' }}>{s}</span>
                ))}
              </div>
            )}

            {/* Actions: like · views · bookmark */}
            <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => {
                  if (!isSignedIn) { openAuth('sign-in'); return; }
                  setLikeAnim(true); setTimeout(() => setLikeAnim(false), 350);
                  toggleLike(item.id);
                }}
                style={modalActionBtn(isLiked, isLiked ? '#ff4d6d' : 'var(--text)')}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill={isLiked ? '#ff4d6d' : 'none'} stroke={isLiked ? '#ff4d6d' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: likeAnim ? 'scale(1.35)' : 'scale(1)', transition: 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}>
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                <span>{isLiked ? 'Liked' : 'Like'}</span>
                <span style={{ opacity: 0.7 }}>· {formatCount(item.like_count)}</span>
              </button>

              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 999, fontSize: 12, color: 'var(--text-dim)' }} title="Views">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>{formatCount(item.view_count)} views</span>
              </span>

              <button
                type="button"
                onClick={() => {
                  if (!isSignedIn) { openAuth('sign-in'); return; }
                  toggleBookmark(item.id);
                }}
                style={modalActionBtn(isBookmarked, isBookmarked ? 'var(--electric)' : 'var(--text)')}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill={isBookmarked ? 'var(--electric)' : 'none'} stroke={isBookmarked ? 'var(--electric)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                </svg>
                <span>{isBookmarked ? 'Saved' : 'Save'}</span>
              </button>
            </div>
          </div>

          {/* Body: paywall OR tabs */}
          {isPremium ? (
            <Paywall item={item} onSubscribe={onSubscribe} />
          ) : (
            <FreeTabs
              tab={tab}
              setTab={setTab}
              hasCode={hasCode}
              hasPrompt={hasPrompt}
              hasUseCase={hasUseCase}
              loading={loading}
              codeText={item.code || ''}
              promptText={content || item.prompt || ''}
              useCaseText={item.use_case || ''}
              copied={copied}
              onCopy={onCopy}
              isSignedIn={isSignedIn}
            />
          )}
        </div>

        {/* Responsive: on narrow screens stack the columns */}
        <style>{`
          @media (max-width: 820px) {
            .cue-detail-modal { flex-direction: column; max-height: 92vh; }
            .cue-detail-media { flex: 0 0 auto; aspect-ratio: 16/10; min-height: 0; }
            .cue-detail-side { border-left: none; border-top: 1px solid var(--border); }
          }
        `}</style>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Free item: Code / Prompt / Use Case tabs
function FreeTabs({ tab, setTab, hasCode, hasPrompt, hasUseCase, loading, codeText, promptText, useCaseText, copied, onCopy, isSignedIn }) {
  const TABS = [
    { key: 'code',     label: 'Code',     present: hasCode },
    { key: 'prompt',   label: 'Prompt',   present: hasPrompt },
    { key: 'use_case', label: 'Use Case', present: hasUseCase },
  ];
  const presentTabs = TABS.filter((t) => t.present);
  const showToggle = presentTabs.length >= 2;

  // Ensure active is a present tab; fall back to the first available.
  const active = presentTabs.some((t) => t.key === tab) ? tab : (presentTabs[0]?.key || 'code');

  const bodyText = active === 'code' ? codeText : active === 'prompt' ? promptText : useCaseText;
  const isEmpty = !bodyText || !bodyText.trim();
  const isProse = active === 'use_case'; // use case = readable text, not monospace

  const activeLabel = TABS.find((t) => t.key === active)?.label || active;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 240 }}>
      {/* Segmented tab control (only when 2+ tabs present) */}
      {showToggle ? (
        <div style={{ display: 'inline-flex', padding: 3, background: '#0e0e10', border: '1px solid var(--border)', borderRadius: 999, alignSelf: 'flex-start', marginBottom: 14 }}>
          {presentTabs.map((t) => {
            const on = active === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  padding: '6px 16px', borderRadius: 999,
                  background: on ? 'var(--electric)' : 'transparent',
                  color: on ? '#fff' : 'var(--text-dim)',
                  border: 'none', cursor: 'pointer',
                  fontSize: 11.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                }}
              >{t.label}</button>
            );
          })}
        </div>
      ) : (
        <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600, marginBottom: 10 }}>
          {activeLabel}
        </div>
      )}

      {/* Body — signed-out users see a blurred + overlay-locked version so
          the text is teasingly visible but not readable / selectable. */}
      <div style={{ position: 'relative' }}>
        <div
          className="custom-scrollbar"
          data-lenis-prevent
          style={{
            flex: 1, minHeight: 160, maxHeight: 340,
            background: isProse ? 'transparent' : '#0b0b0d',
            border: isProse ? 'none' : '1px solid var(--border)',
            borderRadius: 8, padding: isProse ? '4px 0' : 16, overflow: 'auto',
            filter: (!isSignedIn && !isEmpty) ? 'blur(6px)' : 'none',
            userSelect: (!isSignedIn && !isEmpty) ? 'none' : 'auto',
            pointerEvents: (!isSignedIn && !isEmpty) ? 'none' : 'auto',
            transition: 'filter 0.25s ease',
          }}
        >
          {loading ? (
            <div style={{ color: 'var(--text-dim)', fontSize: 13, padding: 20, textAlign: 'center' }}>Loading…</div>
          ) : isEmpty ? (
            <div style={{ color: 'var(--text-dimmer)', fontSize: 12.5, padding: 12, fontStyle: 'italic' }}>
              {active === 'code' ? 'No component code available for this item.' : active === 'prompt' ? 'No prompt available for this item.' : 'No use case notes for this item.'}
            </div>
          ) : isProse ? (
            <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 14, lineHeight: 1.6, color: 'var(--text)' }}>
              {bodyText}
            </p>
          ) : (
            <pre style={{ margin: 0, fontFamily: 'Menlo, Consolas, monospace', fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-dim)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {bodyText}
            </pre>
          )}
        </div>

        {/* Locked overlay for signed-out users */}
        {!isSignedIn && !isEmpty && !loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 10,
            background: 'linear-gradient(180deg, rgba(11,11,13,0.35) 0%, rgba(11,11,13,0.72) 60%, rgba(11,11,13,0.85) 100%)',
            borderRadius: 8,
            padding: 20,
            textAlign: 'center',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 999,
              background: 'rgba(0,0,255,0.14)', border: '1px solid rgba(0,0,255,0.45)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff',
            }}>
              <LockIcon size={18} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>
              Sign in to see the {active === 'prompt' ? 'prompt' : active === 'code' ? 'code' : 'notes'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', maxWidth: 320, lineHeight: 1.5 }}>
              Free — takes 10 seconds. Sign in unlocks selected components + 2 AI prompts a day.
            </div>
          </div>
        )}
      </div>

      {/* Copy button — signed-out users see a sign-in gate first */}
      <button
        onClick={() => onCopy(active)}
        disabled={isEmpty}
        style={{
          marginTop: 14, padding: '13px 18px',
          background: isEmpty ? '#1c1c1e' : 'var(--electric)',
          color: isEmpty ? 'var(--text-dimmer)' : '#fff',
          border: 'none', borderRadius: 8,
          fontSize: 13.5, fontWeight: 600, letterSpacing: '0.02em',
          cursor: isEmpty ? 'not-allowed' : 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: isEmpty ? 'none' : '0 6px 24px -8px rgba(0,0,255,0.55)',
          transition: 'transform 0.15s ease, background 0.2s ease',
        }}
      >
        {copied === active ? (
          <><CheckIcon /> Copied</>
        ) : !isSignedIn ? (
          <>
            <LockIcon size={14} />
            Sign in to copy {activeLabel.toLowerCase()}
          </>
        ) : (
          `Copy ${activeLabel.toLowerCase()}`
        )}
      </button>
      {!isSignedIn && !isEmpty && (
        <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-dim)', textAlign: 'center' }}>
          Free — sign in takes 10 seconds
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paid item: paywall gate. Only Cue+ subscription unlocks the prompt.
// Per-component purchase has been removed — one library, one subscription.
// Code delivery is on the roadmap; for now Cue+ unlocks the PROMPT.
function Paywall({ item, onSubscribe }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      padding: '28px 20px',
      border: '1px solid rgba(0,0,255,0.22)',
      background: 'linear-gradient(180deg, rgba(0,0,255,0.05) 0%, rgba(0,0,255,0.01) 100%)',
      borderRadius: 12,
      textAlign: 'center',
      gap: 14,
    }}>
      <div style={{ color: 'var(--electric)', marginBottom: 2 }}>
        <LockIcon size={28} />
      </div>
      <div style={{ fontSize: 10.5, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--electric)', fontWeight: 700 }}>
        Cue+ Premium
      </div>
      <h3 style={{ fontFamily: '"Cormorant Garamond", "EB Garamond", Georgia, serif', fontSize: 26, fontWeight: 400, margin: 0, color: '#fff', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
        Unlock the prompt
      </h3>
      <p style={{ margin: '2px 6px 6px', fontSize: 13, lineHeight: 1.55, color: 'var(--text-dim)' }}>
        Subscribe to Cue+ for the prompts behind every premium component. Production code delivery — <span style={{ color: 'var(--text)' }}>coming in a future update</span>.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 6 }}>
        <button
          onClick={onSubscribe}
          style={{
            padding: '14px 20px',
            background: 'var(--electric)', color: '#fff', border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.02em',
            boxShadow: '0 6px 24px -8px rgba(0,0,255,0.55)',
          }}
        >
          Subscribe to Cue+ →
        </button>
      </div>
      <div style={{ marginTop: 6, fontSize: 11.5, color: 'var(--text-dimmer)' }}>
        <a href="#/pricing" style={{ color: 'var(--text-dim)', textDecoration: 'underline', textUnderlineOffset: 3 }}>See what's included →</a>
      </div>
    </div>
  );
}
