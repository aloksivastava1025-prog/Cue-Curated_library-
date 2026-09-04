import { useEffect, useRef, useState } from 'react'
import { optimizeCloudinaryUrl } from '../lib/media.js'

/**
 * CardThumb — grid tile with hover-to-play video.
 *
 * Perf strategy: don't touch a card's video until it's actually
 * near the viewport, then start buffering aggressively so hover
 * feels instant. With 75+ cards this keeps total egress bounded
 * (only ~1 viewport-worth of videos warming at a time) while
 * making play latency imperceptible for cards the user can see.
 *
 *   Card off-screen        → no <video> element at all (0 bytes)
 *   Within 500px of view   → <video preload="auto"> starts fetch,
 *                            poster shows the thumb so tile isn't
 *                            blank while first frames arrive
 *   Hover / tap            → play() on already-buffered stream
 */
export default function CardThumb({ brand, variant = 'sans', thumbSrc, hoverSrc }) {
  const [hover, setHover] = useState(false)
  const [warm, setWarm]   = useState(false)  // near-viewport → mount video
  const videoRef = useRef(null)
  const wrapRef  = useRef(null)

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

  // Near-viewport prewarm — mount the <video> tag (which triggers
  // preload="auto") when the card is within 500px of the fold, so
  // by the time the cursor lands on it the first chunks are already
  // buffered. Once warmed we disconnect the observer — no need to
  // unmount if the user scrolls away.
  useEffect(() => {
    if (!hoverSrc || !wrapRef.current || warm) return
    const el = wrapRef.current
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { setWarm(true); io.disconnect() }
      })
    }, { rootMargin: '500px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hoverSrc, warm])

  // On touch devices (no hover) autoplay the video when the card
  // scrolls into view — otherwise mobile users just see a thumbnail
  // and never know the card has motion. Desktop keeps hover behavior.
  useEffect(() => {
    if (!hoverSrc || !wrapRef.current) return
    const noHover = typeof window !== 'undefined'
      && window.matchMedia && window.matchMedia('(hover: none)').matches
    if (!noHover) return
    const el = wrapRef.current
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const v = videoRef.current
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
            decoding="async"
          />
        )}
        {hoverSrc && warm && (
          <video
            ref={videoRef}
            className="thumb-video"
            src={optimizeCloudinaryUrl(hoverSrc)}
            poster={thumbSrc || undefined}
            muted
            loop
            playsInline
            preload="auto"
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
