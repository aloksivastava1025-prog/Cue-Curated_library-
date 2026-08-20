import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { isPremium as isPremiumItem, primaryCategory as primaryCategoryOf } from '../lib/promptHelpers.js';

function formatCount(n) {
  const x = Number(n) || 0;
  if (x >= 1e6) return (x / 1e6).toFixed(x >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'm';
  if (x >= 1e3) return (x / 1e3).toFixed(x >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(x);
}

export default function EditorialCard({ item, setSelectedItem }) {
  const { bookmarkedIds, likedIds, toggleBookmark, toggleLike } = useApp();
  const { isSignedIn } = useUser();
  const { openAuth } = useAuth();
  const isBookmarked = bookmarkedIds?.has(item.id);
  const isLiked = likedIds?.has(item.id);
  const [likeAnim, setLikeAnim] = useState(false);
  const [inView, setInView] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    }, { rootMargin: '200px' });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // Touch devices: no hover → treat "card centered in viewport" as
  // hover. Second observer with a strict threshold so only the card
  // the user is actually looking at plays its video.
  useEffect(() => {
    if (!ref.current) return;
    const noHover = typeof window !== 'undefined'
      && window.matchMedia && window.matchMedia('(hover: none)').matches;
    if (!noHover) return;
    const io = new IntersectionObserver(([entry]) => {
      setIsHovered(entry.isIntersecting && entry.intersectionRatio >= 0.55);
    }, { threshold: [0, 0.55, 1] });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isHovered && inView) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [isHovered, inView]);

  const formatAgo = (iso) => {
    if (!iso) return '';
    const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 30) return `${days} days ago`;
    const m = Math.floor(days / 30);
    return m === 1 ? '1 month ago' : `${m} months ago`;
  };

  // Supabase rows use created_at (snake_case); seed data may use camelCase.
  const createdAtIso = item.created_at || item.createdAt || null;
  const timeTag = formatAgo(createdAtIso);
  // "New" pill only for items dropped in the last 7 days. Previous logic
  // (item.isNew !== false) treated every DB row as new because the field
  // does not exist on Supabase rows — false positives everywhere.
  const isNew = createdAtIso
    ? (Date.now() - new Date(createdAtIso).getTime()) < 7 * 24 * 60 * 60 * 1000
    : false;
  const isPaid = isPremiumItem(item);

  // Show only the primary category, not the full tag dump.
  const primaryCategory = primaryCategoryOf(item);

  const hoverIsImage = item.hoverSrc && /\.(jpeg|jpg|gif|png|webp|svg|heic)$/i.test(item.hoverSrc);
  const hoverIsVideo = item.hoverSrc && !hoverIsImage;
  const shouldMountHoverVideo = hoverIsVideo && inView && (isHovered || !item.thumbSrc);

  const pillBase = {
    padding: '5px 11px',
    borderRadius: '999px',
    fontFamily: 'var(--font-sans)',
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
  };

  return (
    <article
      ref={ref}
      onClick={() => setSelectedItem(item)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        background: isHovered ? '#212124' : 'var(--card-bg)',
        borderRadius: '14px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.3s ease',
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        contentVisibility: 'auto',
        containIntrinsicSize: '360px',
        willChange: isHovered ? 'transform' : 'auto',
      }}
      className="resource-card"
    >
      {/* Media frame — inset with rounded corners, Osmo-style */}
      <div style={{ position: 'relative', aspectRatio: '16 / 10', background: 'var(--card-img-bg)', overflow: 'hidden', margin: '8px 8px 0', borderRadius: '8px' }}>

        {/* Inner hairline */}
        <div style={{ position: 'absolute', inset: 0, borderRadius: '8px', boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.04)', pointerEvents: 'none', zIndex: 4 }}></div>

        {/* Badges */}
        <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 3, display: 'flex', gap: '6px' }}>
          {isPaid ? (
            <span style={{ ...pillBase, background: 'var(--electric)', color: '#fff' }}>Cue+</span>
          ) : isNew ? (
            <span style={{ ...pillBase, background: 'var(--electric)', color: '#fff' }}>New</span>
          ) : null}
          <span style={{ ...pillBase, background: 'rgba(6,6,6,0.72)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.06)' }}>
            {timeTag}
          </span>
        </div>

        {!item.hoverSrc && !item.thumbSrc && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'linear-gradient(135deg, #1a1a1c 0%, #0d0d10 100%)', transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)', transform: isHovered ? 'scale(1.04)' : 'scale(1)' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(22px, 3vw, 36px)', fontStyle: 'italic', fontWeight: 400, color: 'var(--text)', textAlign: 'center', lineHeight: 1.1, letterSpacing: '-0.015em' }}>
              {item.title}
            </span>
          </div>
        )}

        {item.thumbSrc && (
          <img
            src={item.thumbSrc}
            alt={item.title}
            loading="lazy"
            decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)', transform: isHovered ? 'scale(1.04)' : 'scale(1)', zIndex: 1 }}
          />
        )}

        {hoverIsImage && (
          <img
            src={item.hoverSrc}
            alt={item.title}
            loading="lazy"
            decoding="async"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease', opacity: isHovered ? 1 : 0, transform: isHovered ? 'scale(1.04)' : 'scale(1)', zIndex: 2 }}
          />
        )}

        {shouldMountHoverVideo && (
          <video
            ref={videoRef}
            src={item.hoverSrc}
            loop
            muted
            playsInline
            preload="metadata"
            /* `contain` = show the whole video, add thin letterbox if aspect
               ratios differ, instead of cropping the sides. Users need to
               see the full frame to judge the effect. */
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: '#000', transition: 'opacity 0.4s ease', opacity: (isHovered || !item.thumbSrc) ? 1 : 0, zIndex: 2 }}
          />
        )}
      </div>

      {/* Meta */}
      <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '16px', fontWeight: 500, lineHeight: 1.25, letterSpacing: '-0.01em', color: isHovered ? '#fff' : 'var(--text)', transition: 'color 0.2s ease' }}>
          {item.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
            {primaryCategory}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {/* Like */}
            <button
              type="button"
              aria-label={isLiked ? 'Unlike' : 'Like'}
              onClick={(e) => {
                e.stopPropagation();
                if (!isSignedIn) { openAuth('sign-in'); return; }
                setLikeAnim(true); setTimeout(() => setLikeAnim(false), 350);
                toggleLike(item.id);
              }}
              className="cue-card-action"
              style={cardActionBtn(isLiked, isLiked ? '#ff4d6d' : 'var(--text-dim)')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill={isLiked ? '#ff4d6d' : 'none'} stroke={isLiked ? '#ff4d6d' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: likeAnim ? 'scale(1.35)' : 'scale(1)', transition: 'transform 220ms cubic-bezier(0.34, 1.56, 0.64, 1)' }} aria-hidden="true">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', minWidth: 8 }}>{formatCount(item.like_count)}</span>
            </button>
            {/* Views (display only) */}
            <span title="Views" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-dim)', padding: '6px 8px' }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span style={{ fontWeight: 600 }}>{formatCount(item.view_count)}</span>
            </span>
            {/* Bookmark */}
            <button
              type="button"
              aria-label={isBookmarked ? 'Remove bookmark' : 'Bookmark'}
              onClick={(e) => {
                e.stopPropagation();
                if (!isSignedIn) { openAuth('sign-in'); return; }
                toggleBookmark(item.id);
              }}
              className="cue-card-action"
              style={cardActionBtn(isBookmarked, isBookmarked ? 'var(--electric)' : 'var(--text-dim)')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill={isBookmarked ? 'var(--electric)' : 'none'} stroke={isBookmarked ? 'var(--electric)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Hover affordance for the like/bookmark chips — makes it
          clear these are actual buttons and not passive labels. */}
      <style>{`
        .cue-card-action:hover {
          background: rgba(255,255,255,0.06) !important;
          border-color: rgba(255,255,255,0.16) !important;
          transform: translateY(-1px);
        }
        .cue-card-action:active {
          transform: translateY(0);
        }
      `}</style>
    </article>
  );
}

const cardActionBtn = (active, color) => ({
  display: 'inline-flex', alignItems: 'center', gap: 5,
  padding: '6px 10px',
  minHeight: 30,
  background: active ? 'rgba(255,255,255,0.02)' : 'transparent',
  border: '1px solid ' + (active ? color : 'rgba(255,255,255,0.08)'),
  borderRadius: 999,
  color,
  cursor: 'pointer',
  transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease, transform 0.15s ease',
  lineHeight: 1,
});
