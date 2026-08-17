// Shared derivations for prompt items. Kept in one place because the DB
// column is `tier` ('free' | 'premium'), the app translates to 'paid'
// on read, and legacy seed data uses `price === 'premium'`. Anywhere
// that gates on Cue+ status must use the same check.

export const isPremium = (item) =>
  !!item && (item.tier === 'paid' || item.tier === 'premium' || item.price === 'premium')

// Category fallback — used on both the card AND modal. Keep in sync.
export const primaryCategory = (item) =>
  ((item?.category || '').split(',')[0].trim()) || 'Uncategorized'

// created_at accessor that survives snake_case (Supabase) + camelCase (seed).
export const itemCreatedAt = (item) => item?.created_at || item?.createdAt || null
