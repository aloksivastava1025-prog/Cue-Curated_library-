-- ============================================================
-- Cue — featured-rail explicit override columns
-- ============================================================
-- Adds boolean columns so admins can force-include or force-exclude
-- a component from a category rail on the home page, without having
-- to fight the deriveItemTags keyword rules.
--
-- Semantics (each column is nullable — null means "auto-detect from
-- tags/title, honour deriveItemTags"):
--   true   → always include on this rail, regardless of tags
--   false  → always exclude, even if tags would auto-include
--   null   → auto-detect (default)
--
-- Only WebGL right now; extend the pattern when we open more rails.
-- ============================================================

alter table prompts
  add column if not exists featured_webgl boolean;

comment on column prompts.featured_webgl is
  'Admin override for the Signature WebGL rail. true = force include, false = force exclude, null = auto-detect via deriveItemTags.';
