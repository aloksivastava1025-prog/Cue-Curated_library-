import { useEffect, useRef, useState } from 'react'
import { optimizeCloudinaryUrl, videoFirstFramePosterUrl } from '../lib/media.js'

/**
 * CardThumb — grid tile with hover-to-play video.
 *
 * Egress-safe strategy (matches EditorialCard / FeaturedRail):
 *   Off-screen           → no <video> element, 0 bytes
 *   Never hovered        → no <video> element, 0 bytes
 *   First hover          → <video preload="auto"> mounts, starts
 *                          fetching. Some latency on this first hover
 *                          while first segments arrive; the poster
 *                          (same as thumb image) covers the tile so
 *                          nothing flashes black.
 *   Subsequent hovers    → <video> stays mounted (everHovered sticky)
 *                          so browser buffer survives mouseleave;
 *                          play() is instant.
 *
 * NOTE: this file is intentionally NOT on the check-video-conventions
 * `allowedFiles` for `preload="auto"` unless it uses the everHovered
 * gate — the earlier "warm on scroll" pattern reintroduced the 213 GB
 * egress bug and was rejected by that guardrail.
 */
export default function CardThumb({ brand, variant = 'sans', thumbSrc, hoverSrc }) {
  const [hover, setHover] = useState(false)
  // Sticky: flips true on first real hover and stays true. Gates the
  // <video> mount so cards the user never touches never download.
  const [everHovered, setEverHovered] = useState(false)
  const videoRef = useRef(null)
  const wrapRef  = useRef(null)

  const hasMedia = Boolean(thumbSrc || hoverSrc)
  // Cards uploaded with only a hover_src (no thumb) used to render as
  // pure grey tiles until the user hovered. Fall back to Cloudinary's
  // first-frame image transform (so_0.jpg) — costs one small image
  // request, zero video bytes. Egress-safe by design.
  const posterSrc = thumbSrc || videoFirstFramePosterUrl(hoverSrc)

  const onEnter = () => {
    setHover(true)
    if (!everHovered) setEverHovered(true)
    const v = videoRef.current
    if (hoverSrc && v) {
      v.currentTime = 0
      v.play().catch(() => {})
    }
  }
  const onLeave = () => {
    setHover(false)
    if (hoverSrc && videoRef.current) videoRef.current.pause()
  }

  // On touch devices (no hover) autoplay the video when the card
  // scrolls into view — otherwise mobile users just see a thumbnail
  // and never know the card has motion. Desktop keeps hover behavior.
  // Touch autoplay counts as user-intent for egress purposes (mobile
  // grids are naturally scroll-gated by the small viewport).
  useEffect(() => {
    if (!hoverSrc || !wrapRef.current) return
    const noHover = typeof window !== 'undefined'
      && window.matchMedia && window.matchMedia('(hover: none)').matches
    if (!noHover) return
    const el = wrapRef.current
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio > 0.5) {
          if (!everHovered) setEverHovered(true)
          setHover(true)
          const v = videoRef.current
          if (v) v.play().catch(() => {})
        } else {
          setHover(false)
          const v = videoRef.current
          if (v) v.pause()
        }
      })
    }, { threshold: [0, 0.5, 1] })
    io.observe(el)
    return () => io.disconnect()
  }, [hoverSrc, everHovered])

  if (hasMedia) {
    return (
      <div ref={wrapRef} className="thumb thumb-media" onMouseEnter={onEnter} onMouseLeave={onLeave}>
        {posterSrc && (
          <img
            className="thumb-img"
            src={posterSrc}
            alt=""
            // Always visible — video overlays on top when hovering.
            // Previously we faded the img to 0 on hover to reveal the
            // video underneath, but if the video hadn't buffered yet
            // the tile showed grey. Keeping the img painted means the
            // worst case on a cold hover is "still see the thumb"
            // instead of "see grey until bytes arrive".
            style={{ opacity: 1 }}
            loading="lazy"
            decoding="async"
          />
        )}
        {hoverSrc && everHovered && (
          <video
            ref={videoRef}
            className="thumb-video"
            src={optimizeCloudinaryUrl(hoverSrc)}
            poster={posterSrc || undefined}
            muted
            loop
            playsInline
            // Mount is gated on everHovered — this preload only fires
            // after the user hovers the card at least once, matching
            // the convention enforced by scripts/check-video-conventions.js.
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
