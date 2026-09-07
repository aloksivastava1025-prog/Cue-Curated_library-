import { useEffect } from 'react'

/**
 * Small helper to set per-route <title> / description / OG tags without
 * pulling in react-helmet. Cleans up back to defaults on unmount so nav
 * between pages doesn't leak stale metadata.
 */
const DEFAULTS = {
  title: 'Cue — the Awwwards-tier UI component library ($99 lifetime)',
  description: 'Cue is a curated UI component library — Awwwards-tier animations, hero flows, and interactions hand-picked by a founder-designer. Every component ships with an AI prompt for Cursor, v0, Bolt, and Claude. Join Cue+ at $99 lifetime.',
  ogImage: 'https://cuedesign.space/og-image.png',
}

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(selector)
  if (!el) {
    el = document.createElement('meta')
    Object.entries(attrs.tag || {}).forEach(([k, v]) => el.setAttribute(k, v))
    document.head.appendChild(el)
  }
  el.setAttribute('content', attrs.content)
  return el
}

export function usePageMeta({ title, description, ogImage, canonical } = {}) {
  useEffect(() => {
    const prev = {
      title: document.title,
      desc: document.querySelector('meta[name="description"]')?.getAttribute('content'),
      ogTitle: document.querySelector('meta[property="og:title"]')?.getAttribute('content'),
      ogDesc: document.querySelector('meta[property="og:description"]')?.getAttribute('content'),
      ogImage: document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
    }

    const finalTitle = title ? `${title} · CUE` : DEFAULTS.title
    const finalDesc = description || DEFAULTS.description
    const finalOg = ogImage || DEFAULTS.ogImage

    document.title = finalTitle
    upsertMeta('meta[name="description"]', { content: finalDesc, tag: { name: 'description' } })
    upsertMeta('meta[property="og:title"]', { content: finalTitle, tag: { property: 'og:title' } })
    upsertMeta('meta[property="og:description"]', { content: finalDesc, tag: { property: 'og:description' } })
    upsertMeta('meta[property="og:image"]', { content: finalOg, tag: { property: 'og:image' } })
    upsertMeta('meta[name="twitter:title"]', { content: finalTitle, tag: { name: 'twitter:title' } })
    upsertMeta('meta[name="twitter:description"]', { content: finalDesc, tag: { name: 'twitter:description' } })
    upsertMeta('meta[name="twitter:image"]', { content: finalOg, tag: { name: 'twitter:image' } })

    if (canonical) {
      let link = document.querySelector('link[rel="canonical"]')
      if (!link) {
        link = document.createElement('link')
        link.rel = 'canonical'
        document.head.appendChild(link)
      }
      link.setAttribute('href', canonical)
    }

    return () => {
      document.title = prev.title || DEFAULTS.title
      // Restore prior meta values so quick back-nav doesn't leave a
      // Contact page's title/description hanging on a Pricing view.
      if (prev.desc)    upsertMeta('meta[name="description"]',    { content: prev.desc,    tag: { name: 'description' } })
      if (prev.ogTitle) upsertMeta('meta[property="og:title"]',   { content: prev.ogTitle, tag: { property: 'og:title' } })
      if (prev.ogDesc)  upsertMeta('meta[property="og:description"]', { content: prev.ogDesc, tag: { property: 'og:description' } })
      if (prev.ogImage) upsertMeta('meta[property="og:image"]',   { content: prev.ogImage, tag: { property: 'og:image' } })
    }
  }, [title, description, ogImage, canonical])
}
