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
  const [mouseHover, setMouseHover] = useState(false);
  const [inViewportPlay, setInViewportPlay] = useState(false);
  // Effective active state — either the mouse is over the card OR it
  // is centered enough in the viewport to auto-play. Separating the
  // two prevents mouse-leave from pausing a card that's still on-screen.
  const isHovered = mouseHover || inViewportPlay;
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const ref = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    }, { rootMargin: '200px' });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  // Auto-play videos for any card that's genuinely in view — desktop
  // and mobile. Whichever row the user is looking at, its videos play
  // silently as ambient motion (matches Awwwards / motionsites.ai).
  // Cards that leave the viewport pause automatically so the browser
  // doesn't burn cycles on off-screen video decode.
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([entry]) => {
      setInViewportPlay(entry.isIntersecting && entry.intersectionRatio >= 0.4);
    }, { threshold: [0, 0.4, 0.8, 1] });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (isHovered && inView) {
      // Kick play now and again once metadata lands — the initial
      // call can be a no-op if the element hasn't buffered enough
      // to start (autoplay policy or byte races). The onLoadedData/
      // onCanPlay handlers on the <video> below provide a second
      // trigger; this useEffect stays as the state-change entry.
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
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
  // A card has "code" when the admin dropped a full React/HTML snippet
  // in on top of the prompt. Shown as a pill so users can spot at a
  // glance which items ship copy-pasteable source vs prompt-only.
  const hasCode = !!(item.code && String(item.code).trim());

  // Show only the primary category, not the full tag dump.
  const primaryCategory = primaryCategoryOf(item);

  const hoverIsImage = item.hoverSrc && /\.(jpeg|jpg|gif|png|webp|svg|heic)$/i.test(item.hoverSrc);
  const hoverIsVideo = item.hoverSrc && !hoverIsImage;
  // Mount the <video> whenever we have a hover video source. Previous
  // `inView` gate meant off-screen (and sometimes on-screen but not-yet
  // observed) cards never got the element mounted at all — so users
  // saw a black rectangle instead of the video first-frame poster.
  // preload="metadata" keeps the actual byte cost small; play() only
  // fires on real hover, so bandwidth is bounded.
  const shouldMountHoverVideo = hoverIsVideo;

  const pillBase = {
    // Bumped from 10px / 5px×11px — real-user feedback (Ibrahim, Aug 24)
    // said tags were hard to see. New size reads cleanly at desktop
    // and mobile without hijacking the card visually.
    padding: '6px 13px',
    borderRadius: '999px',
    fontFamily: 'var(--font-sans)',
    fontSize: '11.5px',
    fontWeight: 700,
    letterSpacing: '0.055em',
    textTransform: 'uppercase',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
  };

  return (
    <article
      ref={ref}
      onClick={() => setSelectedItem(item)}
      onMouseEnter={() => setMouseHover(true)}
      onMouseLeave={() => setMouseHover(false)}
      style={{
        position: 'relative',
        /* Card-level lift + bg change stays gated on real mouse hover
           (mouseHover) — otherwise every viewport-visible card would
           lift/tint permanently, which looks noisy. Video play/thumb
           swap still uses isHovered (mouseHover OR inViewportPlay). */
        background: mouseHover ? '#212124' : 'var(--card-bg)',
        borderRadius: '14px',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1), background-color 0.3s ease',
        transform: mouseHover ? 'translateY(-4px)' : 'translateY(0)',
        willChange: mouseHover ? 'transform' : 'auto',
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
          <span style={{ ...pillBase, background: 'rgba(0,0,0,0.78)', color: '#fff', border: '1px solid rgba(255,255,255,0.14)' }}>
            {timeTag}
          </span>
          {hasCode && (
            <span
              title="Includes copy-pasteable React source"
              style={{
                ...pillBase,
                background: 'rgba(204,255,0,0.14)',
                color: '#ccff00',
                border: '1px solid rgba(204,255,0,0.4)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
              Code
            </span>
          )}
        </div>

        {/* Title-fallback removed — every card now has a thumbnail
            (backfilled + auto-generated on future uploads), so a black
            base card is enough backdrop. Video overlays on top. */}

        {item.thumbSrc && (
          <img
            src={item.thumbSrc}
            alt={item.title}
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              /* `contain` matches the video's own objectFit — image and
                 video render at the same actual size so the hover swap
                 doesn't cause a jump. Letterboxes gracefully if aspect
                 ratios differ. */
              objectFit: 'contain',
              background: '#000',
              transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.35s ease',
              transform: isHovered ? 'scale(1.04)' : 'scale(1)',
              /* Only hide the image once the video is *actually
                 playing* — previously we hid it as soon as the card
                 entered the viewport, but the video was still buffering
                 so users saw the poster (same image) with no motion and
                 assumed the animation never fired. */
              opacity: (isHovered && videoReady && !videoFailed) ? 0 : 1,
              zIndex: 1,
            }}
          />
        )}

        {hoverIsImage && (
          <img
            src={item.hoverSrc}
            alt={item.title}
            loading="lazy"
            decoding="async"
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.6s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.4s ease', opacity: isHovered ? 1 : 0, transform: isHovered ? 'scale(1.04)' : 'scale(1)', zIndex: 2 }}
          />
        )}

        {shouldMountHoverVideo && !videoFailed && (
          <video
            ref={videoRef}
            src={item.hoverSrc}
            poster={item.thumbSrc || undefined}
            loop
            muted
            playsInline
            // Once the card is within 200px of the viewport we start
            // buffering so hover → play is instant (was 3-5s with
            // preload="metadata" — user thought cards were static and
            // bounced). Off-screen cards stay on metadata so we don't
            // burn bandwidth on the entire grid.
            preload={inView ? 'auto' : 'metadata'}
            // Multiple readiness signals — some codecs fire only one
            // of these reliably. Any of them flips videoReady, which
            // is what actually reveals the video overlay + hides the
            // thumbnail beneath. Also re-tries play() here in case the
            // effect's play() call raced ahead of the buffer.
            onLoadedData={(e) => {
              setVideoReady(true);
              if (isHovered && inView) { const p = e.currentTarget.play(); if (p?.catch) p.catch(() => {}); }
            }}
            onCanPlay={(e) => {
              if (isHovered && inView) { const p = e.currentTarget.play(); if (p?.catch) p.catch(() => {}); }
            }}
            onPlaying={() => setVideoReady(true)}
            onError={() => setVideoFailed(true)}
            /* Video overlay ONLY visible on hover. Default state = user
               sees the thumbnail (JPEG). On hover the video fades in on
               top and plays. For cards with no thumbnail (rare), video
               is always visible so there's something to look at. */
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'contain',
              transition: 'opacity 0.35s ease',
              // Show video only once it's actually playing. Poster is
              // set to the thumbnail below, so hiding the video overlay
              // while it buffers means users see the real thumbnail —
              // not a frozen first frame — until motion actually starts.
              opacity: (videoReady && (isHovered || !item.thumbSrc)) ? 1 : 0,
              zIndex: 2,
            }}
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
