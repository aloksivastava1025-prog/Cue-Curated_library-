/**
 * Cloudinary URL auto-optimizer.
 *
 * Admin pastes a raw Cloudinary URL (any account, any size) into
 * hover_src / thumb_src. This helper detects Cloudinary URLs and
 * injects the transformation string that trims payload 5-10x with
 * no visible quality loss:
 *
 *   f_auto      → best format per browser (WebM/AV1/MP4)
 *   q_auto:eco  → aggressive automatic quality
 *   w_1200      → cap width at 1200px (cards render at 400-600px)
 *
 * If the URL already carries a transformation segment (e.g. someone
 * copied a pre-optimized link), we leave it alone — never re-transform.
 * Non-Cloudinary URLs pass through unchanged.
 */

const CLOUDINARY_HOST = 'res.cloudinary.com'
// q_auto (no qualifier) = Cloudinary's smart default. Their engine picks
// quality per-frame based on visual complexity — imperceptible drop for
// hover previews but roughly 40-50% smaller than the raw upload.
// w_1600 keeps native-quality on retina modal previews (800-1000px real
// display × 2x pixel density). Cards render at 300-500px, so 1600 is
// still 3x — no perceived softness anywhere.
const VIDEO_TRANSFORM = 'f_auto,q_auto,w_1600'
const IMAGE_TRANSFORM = 'f_auto,q_auto,w_1600'

// Cloudinary URL shape:
//   https://res.cloudinary.com/{cloud}/{resource_type}/{delivery_type}/{transformations?}/{public_id}
// resource_type = image | video | raw
// delivery_type = upload | fetch | private | ...
// A path segment is a "transformation" if it contains any of
// c_/w_/h_/f_/q_/e_/g_ etc — Cloudinary's transform grammar.
const TRANSFORM_HINT = /(?:^|,)(?:[a-z]{1,3}_[a-z0-9]|fl_|dpr_|so_|du_)/i

function needsTransform(pathSegment) {
  return !TRANSFORM_HINT.test(pathSegment)
}

/**
 * Derive a static first-frame image URL from a Cloudinary VIDEO URL,
 * used as a fallback poster when a card has no thumb_src of its own.
 * `so_0` = start offset 0s, `.jpg` = image delivery from the video
 * asset. This costs one image request instead of downloading any of
 * the video payload — safe to use eagerly. Returns null for non-
 * Cloudinary URLs so callers can fall back to their own placeholder.
 */
export function videoFirstFramePosterUrl(videoUrl) {
  if (!videoUrl || typeof videoUrl !== 'string') return null
  if (!videoUrl.includes(CLOUDINARY_HOST)) return null
  try {
    const u = new URL(videoUrl)
    const parts = u.pathname.split('/')
    // Need at least /{cloud}/video/upload/{...} to be safe
    if (parts.length < 5 || parts[2] !== 'video') return null
    if (parts[3] !== 'upload' && parts[3] !== 'fetch') return null
    // Insert so_0,f_jpg,q_auto,w_1200 transform right after delivery.
    const transform = 'so_0,f_jpg,q_auto,w_1200'
    const newParts = [...parts.slice(0, 4), transform, ...parts.slice(4)]
    // Swap the file extension to .jpg so Cloudinary returns an image.
    const last = newParts[newParts.length - 1]
    newParts[newParts.length - 1] = last.replace(/\.(mp4|webm|mov|m4v)$/i, '.jpg')
    u.pathname = newParts.join('/')
    return u.toString()
  } catch { return null }
}

export function optimizeCloudinaryUrl(url) {
  if (!url || typeof url !== 'string') return url
  if (!url.includes(CLOUDINARY_HOST)) return url

  try {
    const u = new URL(url)
    // Split path: ['', cloud, resource_type, delivery_type, maybe_transforms, ...rest]
    const parts = u.pathname.split('/')
    if (parts.length < 5) return url
    const resourceType = parts[2]           // 'video' | 'image' | 'raw'
    const deliveryType = parts[3]           // 'upload' | 'fetch' | ...
    if (deliveryType !== 'upload' && deliveryType !== 'fetch') return url
    const nextSeg = parts[4] || ''
    // Already transformed by whoever pasted — leave it.
    if (!needsTransform(nextSeg)) return url

    const transform =
      resourceType === 'video' ? VIDEO_TRANSFORM :
      resourceType === 'image' ? IMAGE_TRANSFORM :
      null
    if (!transform) return url

    // Insert transform between delivery type and the rest of the path.
    const newParts = [...parts.slice(0, 4), transform, ...parts.slice(4)]
    u.pathname = newParts.join('/')
    return u.toString()
  } catch {
    return url
  }
}
