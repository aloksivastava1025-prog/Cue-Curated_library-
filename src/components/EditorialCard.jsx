import React, { useState, useRef, useEffect } from 'react';

export default function EditorialCard({ item, setSelectedItem }) {
  const [inView, setInView] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setInView(entry.isIntersecting);
    }, { rootMargin: '300px' });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  const formatAgo = (iso) => {
    if (!iso) return '';
    const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
    if (days === 0) return 'today';
    if (days === 1) return '1 day ago';
    if (days < 30) return `${days} days ago`;
    const m = Math.floor(days / 30);
    return m === 1 ? '1 month ago' : `${m} months ago`;
  };

  const timeTag = formatAgo(item.createdAt || new Date().toISOString());
  const isNew = item.isNew !== false;
  const isPaid = item.tier === 'paid' || item.price === 'premium';

  return (
    <article 
      ref={ref} 
      onClick={() => setSelectedItem(item)} 
      onMouseEnter={() => setIsHovered(true)} 
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        position: 'relative', 
        background: 'var(--card-bg)', 
        borderRadius: 0, 
        overflow: 'hidden', 
        cursor: 'pointer', 
        transition: 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1), background 0.35s ease, opacity 0.6s ease', 
        transform: isHovered ? 'translateY(-4px)' : 'translateY(0)',
        backgroundColor: isHovered ? '#232326' : 'var(--card-bg)',
      }}
      className="resource-card"
    >
      <div style={{ position: 'relative', aspectRatio: '16 / 10', background: 'var(--card-img-bg)', overflow: 'hidden', margin: '4px 4px 0' }}>
        
        {/* Inner hairline */}
        <div style={{ position: 'absolute', inset: 0, boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.03)', pointerEvents: 'none', zIndex: 4 }}></div>
        
        {/* Tags Overlay */}
        <div style={{ position: 'absolute', top: '12px', left: '12px', zIndex: 3, display: 'flex', gap: '6px' }}>
          <span style={{ padding: '5px 9px', borderRadius: '3px', fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', backdropFilter: 'blur(16px) saturate(1.2)', background: 'rgba(6,6,6,0.55)', color: 'var(--text)', border: '1px solid rgba(255,255,255,0.04)' }}>
            {timeTag}
          </span>
          {isPaid ? (
            <span style={{ padding: '5px 9px', borderRadius: '3px', fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', background: 'var(--electric)', color: '#fff', border: '1px solid transparent', boxShadow: '0 4px 20px -6px rgba(0,0,255,0.5)' }}>
              Cue+
            </span>
          ) : isNew ? (
            <span style={{ padding: '5px 9px', borderRadius: '3px', fontFamily: 'var(--font-sans)', fontSize: '10px', fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', background: 'var(--electric)', color: '#fff', border: '1px solid transparent', boxShadow: '0 4px 20px -6px rgba(0,0,255,0.5)' }}>
              New
            </span>
          ) : null}
        </div>

        {!item.hoverSrc && !item.thumbSrc && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', background: 'radial-gradient(circle at 30% 20%, rgba(0,0,255,0.18), transparent 45%), radial-gradient(circle at 70% 80%, rgba(0,0,255,0.10), transparent 45%), linear-gradient(135deg, #1a1a1c 0%, #0d0d10 100%)', transition: 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1)', transform: isHovered ? 'scale(1.04)' : 'scale(1)' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(24px, 3.2vw, 40px)', fontStyle: 'italic', fontWeight: 400, color: 'var(--text)', textAlign: 'center', lineHeight: 1.1, letterSpacing: '-0.015em' }}>
              {item.title}
            </span>
          </div>
        )}

        {item.thumbSrc && (
          <img src={item.thumbSrc} alt={item.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), filter 0.5s ease', filter: isHovered ? 'brightness(1) saturate(1)' : 'brightness(0.95) saturate(0.98)', transform: isHovered ? 'scale(1.04)' : 'scale(1)', zIndex: 1 }} />
        )}

        {item.hoverSrc && (
          item.hoverSrc.match(/\.(jpeg|jpg|gif|png|webp|svg|heic)$/i) ? (
            <img src={item.hoverSrc} alt={item.title} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease', opacity: inView && isHovered ? 1 : 0, transform: isHovered ? 'scale(1.04)' : 'scale(1)', zIndex: 2 }} />
          ) : (
            <video src={inView ? item.hoverSrc : ""} autoPlay loop muted playsInline webkit-playsinline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.5s ease', opacity: (inView && isHovered) ? 1 : (inView && !item.thumbSrc) ? 1 : 0, transform: isHovered ? 'scale(1.04)' : 'scale(1)', zIndex: 2 }} />
          )
        )}
      </div>
      <div style={{ padding: '18px 20px 22px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: '20px', fontWeight: 400, lineHeight: 1.2, letterSpacing: '-0.012em', color: isHovered ? '#fff' : 'var(--text)', transition: 'color 0.25s ease' }}>
          {item.title}
        </div>
        <div style={{ fontFamily: 'var(--font-sans)', fontSize: '11px', fontWeight: 500, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-dim)' }}>
          {item.category || 'Hero'}
        </div>
      </div>
    </article>
  );
}
