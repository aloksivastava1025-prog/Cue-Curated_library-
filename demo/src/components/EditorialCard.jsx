import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';

function formatAgo(iso) {
  if (!iso) return '';
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const m = Math.floor(days / 30);
  return m === 1 ? '1 month ago' : `${m} months ago`;
}

export default function EditorialCard({ item, index, onClick }) {
  const videoRef = useRef(null);
  const cardRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);

  // Video autoplay lazy intersection observer
  useEffect(() => {
    if (!videoRef.current) return;
    const videoObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        const video = entry.target;
        if (entry.isIntersecting) {
          if (!video.src && video.dataset.videoSrc) {
            video.src = video.dataset.videoSrc;
          }
          const p = video.play();
          if (p && p.then) {
            p.then(() => { video.dataset.videoStatus = 'playing'; }).catch(() => {});
          }
        } else {
          video.pause();
        }
      });
    }, { threshold: 0.25 });
    
    videoObserver.observe(videoRef.current);
    return () => videoObserver.disconnect();
  }, []);

  const isPaid = item.tier === 'paid' || item.price === 'premium';
  const timeTag = formatAgo(item.createdAt || new Date().toISOString());
  
  const daysOld = Math.max(0, Math.floor((Date.now() - new Date(item.createdAt || Date.now()).getTime()) / 86400000));
  const isNew = item.isNew !== false && daysOld < 30;

  // Spring configs
  const springHover = { type: 'spring', stiffness: 100, damping: 22, mass: 0.8 };

  return (
    <motion.div 
      ref={cardRef} 
      onClick={() => onClick(item)}
      className="resource-card"
      initial={{ opacity: 0, y: 40, filter: 'blur(12px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: 0.6, delay: Math.min((index % 6) * 0.1, 0.5), ease: "easeOut" }}
      whileHover={{ y: -8, rotate: 0.5, boxShadow: '0 24px 48px rgba(0,0,0,0.4)', borderColor: 'rgba(255,255,255,0.12)' }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      style={{ cursor: 'pointer', border: '1px solid var(--border)' }}
    >
      <div className="resource-visual">
        <div className="tags-overlay">
          <motion.span 
            className="tag tag--dim"
            animate={isHovered ? { y: -2, brightness: 1.2 } : { y: 0, brightness: 1 }}
            transition={springHover}
          >
            {timeTag}
          </motion.span>
          
          {isPaid ? (
            <motion.span 
              className="tag tag--electric"
              animate={isHovered ? { y: -2, boxShadow: '0 0 15px rgba(0,0,255,0.8)' } : { y: 0, boxShadow: '0 0 0px rgba(0,0,255,0)' }}
              transition={springHover}
            >
              Cue+
            </motion.span>
          ) : isNew ? (
            <motion.span 
              className="tag tag--electric"
              animate={isHovered ? { y: -2, boxShadow: '0 0 15px rgba(0,0,255,0.8)' } : { y: 0, boxShadow: '0 0 0px rgba(0,0,255,0)' }}
              transition={springHover}
            >
              New
            </motion.span>
          ) : null}
        </div>

        {!item.thumbSrc && !item.hoverSrc && (
          <div className="cover-placeholder">
            <span>{item.title}</span>
          </div>
        )}

        {/* Ken Burns effect on the image */}
        {item.thumbSrc && (
          <motion.img 
            src={item.thumbSrc} 
            className="cover-image" 
            alt={item.title} 
            animate={isHovered ? { scale: 1.03, filter: 'brightness(1.05) contrast(1.05)', transition: springHover } : { scale: [1, 1.04, 1], filter: 'brightness(0.95) contrast(1)', transition: { duration: 20, repeat: Infinity, ease: 'linear' } }}
          />
        )}

        {item.hoverSrc && (
          item.hoverSrc.match(/\.(jpeg|jpg|gif|png|webp|svg|heic)$/i) ? (
            <motion.img 
              src={item.hoverSrc} 
              className="cover-image" 
              style={{ zIndex: 2 }}
              initial={{ opacity: 0 }}
              animate={isHovered ? { opacity: 1, scale: 1.03, filter: 'brightness(1.05) contrast(1.05)', transition: springHover } : { opacity: 0, scale: 1, filter: 'brightness(0.95) contrast(1)', transition: { duration: 0.4 } }}
              alt={item.title} 
            />
          ) : (
            <motion.video 
              ref={videoRef}
              muted loop playsInline webkit-playsinline
              data-video-src={item.hoverSrc}
              data-video-status="not-loaded"
              className="cover-video"
              initial={{ opacity: 0, scale: 1 }}
              animate={isHovered ? { opacity: 1, scale: 1.03, transition: springHover } : { opacity: 0, scale: 1, transition: { duration: 0.4 } }}
            />
          )
        )}
      </div>

      <div className="card-meta">
        <motion.div 
          className="card-title"
          animate={{ color: isHovered ? '#fff' : 'var(--text)' }}
          transition={{ duration: 0.2 }}
        >
          {item.title}
        </motion.div>
        <div className="card-category">{item.category || 'CATEGORY'}</div>
      </div>
    </motion.div>
  );
}
