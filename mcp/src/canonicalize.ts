// Cue MCP — tag / category canonicalisation
// Direct port of the taxonomy the website filter uses so search
// results here match what a user sees on cuedesign.space.

const TAG_ALIASES: Record<string, string> = {
  '3d': '3d & webgl',
  'webgl': '3d & webgl',
  'gl': '3d & webgl',
  'three': '3d & webgl',
  'threejs': '3d & webgl',
  'three.js': '3d & webgl',
  'webgpu': '3d & webgl',
  'hero': 'hero',
  'landing': 'hero',
  'card': 'card',
  'cards': 'card',
  'button': 'button',
  'buttons': 'button',
  'nav': 'nav',
  'navigation': 'nav',
  'menu': 'nav',
  'form': 'form',
  'forms': 'form',
  'modal': 'modal',
  'dialog': 'modal',
  'tabs': 'tabs',
  'accordion': 'accordion',
  'gallery': 'gallery',
  'grid': 'grid',
  'list': 'list',
  'table': 'table',
  'toast': 'toast',
  'tooltip': 'tooltip',
  'loader': 'loader',
  'spinner': 'loader',
  'progress': 'loader',
  'testimonial': 'testimonial',
  'pricing': 'pricing',
  'footer': 'footer',
  'header': 'header',
}

/** Return the lower-cased, canonical form of a raw tag string. */
export function canonicalTag(raw: string): string {
  const key = String(raw || '').toLowerCase().trim()
  return TAG_ALIASES[key] || key
}

/** Deduplicate + canonicalise a list of raw tags. */
export function canonicalTags(raws: string[] = []): string[] {
  const out = new Set<string>()
  for (const r of raws) {
    const t = canonicalTag(r)
    if (t) out.add(t)
  }
  return [...out]
}
