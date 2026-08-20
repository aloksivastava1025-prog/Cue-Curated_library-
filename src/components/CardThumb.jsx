import { useEffect, useRef, useState } from 'react'

export default function CardThumb({ brand, variant = 'sans', thumbSrc, hoverSrc }) {
  const [hover, setHover] = useState(false)
  const videoRef = useRef(null)
  const wrapRef = useRef(null)

  const hasMedia = Boolean(thumbSrc || hoverSrc)

  const onEnter = () => {
    setHover(true)
    if (hoverSrc && videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.play().catch(() => {})
    }
  }
  const onLeave = () => {
    setHover(false)
    if (hoverSrc && videoRef.current) videoRef.current.pause()
  }

  // On touch devices (no hover) autoplay the video when the card
  // scrolls into view — otherwise mobile users just see a thumbnail
  // and never know the card has motion. Desktop keeps hover behavior.
  useEffect(() => {
    if (!hoverSrc || !wrapRef.current) return
    const noHover = typeof window !== 'undefined'
      && window.matchMedia && window.matchMedia('(hover: none)').matches
    if (!noHover) return
    const el = wrapRef.current
    const v = videoRef.current
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!v) return
        if (e.isIntersecting && e.intersectionRatio > 0.5) {
          setHover(true)
          v.play().catch(() => {})
        } else {
          setHover(false)
          v.pause()
        }
      })
    }, { threshold: [0, 0.5, 1] })
    io.observe(el)
    return () => io.disconnect()
  }, [hoverSrc])

  if (hasMedia) {
    return (
      <div ref={wrapRef} className="thumb thumb-media" onMouseEnter={onEnter} onMouseLeave={onLeave}>
        {thumbSrc && (
          <img
            className="thumb-img"
            src={thumbSrc}
            alt=""
            style={{ opacity: hover && hoverSrc ? 0 : 1 }}
            loading="lazy"
          />
        )}
        {hoverSrc && (
          <video
            ref={videoRef}
            className="thumb-video"
            src={hoverSrc}
            muted
            loop
            playsInline
            preload="metadata"
            style={{ opacity: hover ? 1 : 0 }}
          />
        )}
        {!thumbSrc && !hover && hoverSrc && (
          <div className="thumb-body">
            <div className={`thumb-brand ${variant}`}>{brand}</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="thumb">
      <div className="thumb-nav">
        <span className="thumb-logo" aria-hidden="true" />
        <span className="thumb-links" aria-hidden="true">
          <i /><i /><i />
        </span>
      </div>
      <div className="thumb-body">
        <div className={`thumb-brand ${variant}`}>{brand}</div>
        <div className="thumb-line" />
        <div className="thumb-line thumb-line-s" />
      </div>
    </div>
  )
}
