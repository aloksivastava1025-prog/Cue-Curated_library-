import React, { useState, useRef, useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useApp } from '../context/AppContext.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import { isPremium as isPremiumItem, primaryCategory as primaryCategoryOf } from '../lib/promptHelpers.js';
import { optimizeCloudinaryUrl } from '../lib/media.js';
import { useVideoSlot } from '../lib/videoGovernor.js';

function formatCount(n) {
  const x = Number(n) || 0;
  if (x >= 1e6) return (x / 1e6).toFixed(x >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'm';
  if (x >= 1e3) return (x / 1e3).toFixed(x >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k';
  return String(x);
}

const ADMIN_EMAILS = new Set([
  'akashkumar7653099@gmail.com',
  'aloksivastava1025@gmail.com',
  'aloks.int@teachforindia.org',
]);

export default function EditorialCard({ item, setSelectedItem }) {
  const { bookmarkedIds, likedIds, toggleBookmark, toggleLike } = useApp();
  const { isSignedIn, user } = useUser();
  const { openAuth } = useAuth();
  const isAdmin = isSignedIn && ADMIN_EMAILS.has(user?.primaryEmailAddress?.emailAddress);
  const isBookmarked = bookmarkedIds?.has(item.id);
  const isLiked = likedIds?.has(item.id);
  const [likeAnim, setLikeAnim] = useState(false);
  const [mouseHover, setMouseHover] = useState(false);
  // Bandwidth fix (Aug 2026): the previous behaviour auto-played
  // every card ≥40% in viewport, which downloaded the full clip for
  // every visible card as the user scrolled. Egress hit 213 GB in
  // days. New behaviour: video only mounts + downloads when the
  // user *intentionally* hovers over the card. Once mounted, it
  // stays mounted for the rest of the session (see everHovered),
  // so a second hover plays instantly from the browser buffer with
  // no re-download.
  const [everHovered, setEverHovered] = useState(false);
  const isHovered = mouseHover;
  const [videoReady, setVideoReady] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  // Safety net — if the video hasn't emitted onLoadedData/onPlaying
  // within 3s of the card being in view, we still fade the image out.
  // Worst case the user sees the video's poster (which is the same
  // thumbnail) so the visual state at least *changes* on scroll into
  // view instead of appearing frozen.
  const [readyTimeout, setReadyTimeout] = useState(false);
  // If the optimized (transformed) Cloudinary URL 404s — which happens
  // on accounts with "Strict Transformations" enabled — we drop back
  // to the raw URL the admin actually stored. Every Cloudinary account
  // is supported this way, whether transforms are locked down or not.
  const [videoSrcFallback, setVideoSrcFallback] = useState(false);
  const ref = useRef(null);
  const videoRef = useRef(null);

  // Once the user hovers a card, mark it "everHovered" so the <video>
  // stays mounted for the rest of the session. Prevents the second
  // hover from re-downloading (video would unmount on mouseleave
  // otherwise, drop its buffer, and re-fetch on next hover).
  useEffect(() => {
    if (mouseHover && !everHovered) setEverHovered(true);
  }, [mouseHover, everHovered]);

  // Two-tier prefetch: warm the HTTP cache for cards ~1.5 screen
  // heights away WITHOUT mounting a <video> element. Bytes land in
  // the browser cache; no decoder slot is used and no governor
  // pressure is created. When the card actually enters the viewport
  // and mounts its <video>, the source pulls from cache — play() is
  // instant instead of waiting on a fresh HTTP round-trip. Runs once
  // per card via the disconnect-on-hit pattern.
  useEffect(() => {
    if (!ref.current || !hoverIsVideo) return;
    const url = optimizeCloudinaryUrl(item.hoverSrc);
    if (!url) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        // Fire-and-forget fetch — browser stores response in the
        // shared HTTP cache. no-cors keeps R2 URLs from tripping
        // CORS since we only care about cache warming, not the
        // response body.
        try { fetch(url, { mode: 'no-cors', credentials: 'omit' }).catch(() => {}); } catch {}
        io.disconnect();
      }
    }, { rootMargin: '1200px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, [item.id, item.hoverSrc]);

  // Viewport-triggered auto-play for ALL devices (desktop + touch).
  // Original ambient-motion behaviour: as a card scrolls into view,
  // its hover video plays; as it leaves, it pauses. Was disabled
  // during the Supabase egress incident, but since all media now
  // lives on Cloudflare R2 with unlimited free egress, the cost
  // concern is gone. The video governor still caps total mounted
  // <video> elements at 20 as a defence-in-depth safety net.
  //
  // Threshold reasoning:
  //   - Touch (no hover): 0.8 — most-centered card only, at most 1
  //     playing at a time on mobile so overlapping audio-off videos
  //     don't create visual chaos on a narrow screen.
  //   - Desktop: 0.4 — matches the original ambient-motion feel
  //     where any card meaningfully in view is playing.
  useEffect(() => {
    if (!ref.current) return;
    const noHover = typeof window !== 'undefined'
      && window.matchMedia && window.matchMedia('(hover: none)').matches;
    // Mobile threshold pulled down to 0.15 — on a narrow phone
    // screen the cards fill most of the viewport, so requiring 40%
    // visibility meant playback only kicked in when a card was
    // almost fully centred (users had to "hover-like" scroll into
    // one card and wait). 15% lets the video start as soon as the
    // card is meaningfully on screen. Desktop stays at 0.25 —
    // multiple cards fit at once, so a low threshold there would
    // trigger 6+ playbacks per scroll (the 5-cap governor would
    // still clamp, but this is friendlier to the pool).
    const threshold = noHover ? 0.15 : 0.25;
    const io = new IntersectionObserver(([entry]) => {
      setMouseHover(entry.isIntersecting && entry.intersectionRatio >= threshold);
    }, { threshold: [0, 0.15, 0.25, 0.4, 0.6, 1] });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  // Grace timer — pulled down from 600ms to 120ms. The <video>
  // element's poster attribute IS this same thumbnail, so hiding the
  // <img> immediately just reveals an identical picture painted by
  // the video element until the first real frame arrives. No gap,
  // no flicker. 120ms is short enough that users perceive the fade
  // as "instant" rather than a visible fallback state.
  useEffect(() => {
    if (!mouseHover) { setReadyTimeout(false); return; }
    if (videoReady) return;
    const t = setTimeout(() => setReadyTimeout(true), 120);
    return () => clearTimeout(t);
  }, [mouseHover, videoReady]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (mouseHover) {
      // Do NOT call v.load() here — that force-refetches the file
      // and was one of the reasons egress blew up. Trust the buffer
      // the browser already has. If the video was just mounted this
      // hover, preload="auto" is already fetching; play() will start
      // as soon as canplay fires.
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    } else {
      v.pause();
    }
  }, [mouseHover]);

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
  // Mount the <video> only after the user has hovered the card at
  // least once this session. Cards the user never touches never
  // download the clip. Once mounted, we keep the element around
  // (everHovered is sticky) so the browser buffer survives a
  // mouseleave — subsequent hovers play instantly with zero extra
  // egress.
  //
  // Additional guard: even if a future regression re-mounts videos
  // on scroll, the useVideoSlot governor caps total mounted clips
  // at MAX_ACTIVE (20). Beyond that, cards fall back to the poster.
  // Slot is claimed ONLY while the card is currently in view or
  // being actively hovered. Sticky `everHovered` used to hold the
  // slot forever after first mount, which meant the first N cards
  // hoarded the pool and later cards showed frozen posters. Tying
  // it to `mouseHover` (which is set by both the viewport
  // IntersectionObserver and real mouse enter/leave) means the
  // moving cards are always the ones the user is actually looking
  // at. Free bandwidth on R2 makes re-mounting on scroll-back cheap.
  const slot = useVideoSlot('editorial-card', item.id, hoverIsVideo && mouseHover)
  // Mount the <video> only for cards that are ACTIVELY in view or
  // being hovered — mirrors the slot claim above. Free R2 bandwidth
  // means a re-mount on scroll-back is cheap; the win is that the
  // grid keeps only ~5 videos alive at any moment, so decode never
  // overloads a laptop GPU.
  const shouldMountHoverVideo = hoverIsVideo && mouseHover && slot.granted;

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
            width={640}
            height={480}
            /* Lazy again — combined with `content-visibility: auto`
               on the parent card, off-screen thumbs don't fetch
               until the browser needs them. Explicit width/height
               above stops the layout from shifting when the image
               lands (fixes the 46-image "missing dimensions"
               finding on the perf audit). Aspect-ratio 4:3 matches
               how the card renders, so no visual distortion. */
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
              /* Crossfade: hide the thumbnail as soon as EITHER the
                 real video paints (videoReady) OR the 600ms grace
                 timer fires (readyTimeout). The old check used
                 `videoReady` alone; on mobile the ready events fire
                 slowly and the thumb stayed visible for 3–5s even
                 though the <video> below had already faded in — the
                 z-index ordering meant users saw a static image the
                 whole time. Trusting the grace timer is safe because
                 the <video>'s poster attribute is this same thumbnail,
                 so hiding the img just reveals an identical picture
                 painted by the video element until the first real
                 frame arrives. */
              opacity: (isHovered && (videoReady || readyTimeout) && !videoFailed) ? 0 : 1,
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
            src={videoSrcFallback ? item.hoverSrc : optimizeCloudinaryUrl(item.hoverSrc)}
            poster={item.thumbSrc || undefined}
            loop
            muted
            playsInline
            // The video only mounts on first hover (everHovered gate
            // above), so preload="auto" here aligns with real user
            // intent — download the clip only when someone is
            // actually asking to see it. Never fires on off-screen
            // or non-interacted cards.
            preload="auto"
            // Multiple readiness signals — some codecs fire only one
            // of these reliably. Any of them flips videoReady, which
            // is what actually reveals the video overlay + hides the
            // thumbnail beneath. Also re-tries play() here in case the
            // effect's play() call raced ahead of the buffer.
            /* Crossfade fires ASAP:
                 - onLoadedData: metadata + first frame available.
                   Flip videoReady so the thumb starts fading. The
                   video's own poster attribute is the same image,
                   so even if the actual play is a beat away, the
                   picture stays identical — no black frame possible.
                 - onCanPlay: enough buffered to start; kick play().
                 - onPlaying: extra safety, in case earlier events
                   were skipped by the codec pipeline. */
            onLoadedData={(e) => {
              setVideoReady(true);
              if (mouseHover) { const p = e.currentTarget.play(); if (p?.catch) p.catch(() => {}); }
            }}
            onCanPlay={(e) => {
              setVideoReady(true);
              if (mouseHover) { const p = e.currentTarget.play(); if (p?.catch) p.catch(() => {}); }
            }}
            onPlaying={() => setVideoReady(true)}
            onError={() => {
              // Strict-Transformations accounts return 404 on the
              // optimized URL. Retry once with the raw URL before
              // giving up — that path works on every Cloudinary
              // account regardless of security settings.
              if (!videoSrcFallback) {
                setVideoSrcFallback(true);
                return;
              }
              setVideoFailed(true);
            }}
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
              opacity: ((videoReady || readyTimeout) && (isHovered || !item.thumbSrc)) ? 1 : 0,
              zIndex: 2,
            }}
          />
        )}

        {/* Bottom-right FREE / PAID chip — user feedback: makes tier
            scannable across the grid without opening a card. Sits on
            top of the media (zIndex 3) but below the inner hairline. */}
        <span
          style={{
            ...pillBase,
            position: 'absolute',
            bottom: 10, right: 10,
            zIndex: 3,
            fontSize: '10.5px',
            padding: '5px 11px',
            background: isPaid ? 'var(--electric)' : 'rgba(0,0,0,0.78)',
            color: '#fff',
            border: `1px solid ${isPaid ? 'transparent' : 'rgba(255,255,255,0.14)'}`,
          }}
        >
          {isPaid ? 'Paid' : 'Free'}
        </span>
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
              {/* Like count admin-only for the same reason view count is —
                  early low numbers anchor perceived popularity down. */}
              {isAdmin && (
                <span title="Likes (admin only)" style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.02em', minWidth: 8 }}>{formatCount(item.like_count)}</span>
              )}
            </button>
            {/* Views (admin-only — regular users never see the traffic
                signal, which prevents anchoring on early-days low counts). */}
            {isAdmin && (
            <span title="Views (admin only)" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-dim)', padding: '6px 8px' }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span style={{ fontWeight: 600 }}>{formatCount(item.view_count)}</span>
            </span>
            )}
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
