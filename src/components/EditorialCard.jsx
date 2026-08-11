import React, { useState, useRef, useEffect } from 'react';

export default function EditorialCard({ item, setSelectedItem }) {
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

  const timeTag = formatAgo(item.createdAt || new Date().toISOString());
  const isNew = item.isNew !== false;
  const isPaid = item.tier === 'paid' || item.price === 'premium';

  // Show only the primary category, not the full tag dump.
  const primaryCategory = (item.category || 'Hero').split(',')[0].trim();

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
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
          {primaryCategory}
        </div>
      </div>
    </article>
  );
}
