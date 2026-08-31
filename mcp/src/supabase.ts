// Cue MCP — Supabase client wrapper
// Uses the anon key baked in at build time. Only public / free
// content is exposed by default; premium prompt text + code goes
// through the mcp-get-component edge function.

import { createClient } from '@supabase/supabase-js'

// These are inlined at build time from the same values the web app
// ships. Safe to embed — the anon key is designed to sit alongside
// public frontend code, and RLS + the mcp-get-component edge
// function enforce paid gating server-side.
const SUPABASE_URL = 'https://rkinvrdjbmoozjzmqshn.supabase.co'
const SUPABASE_ANON_KEY = process.env.CUE_SUPABASE_ANON_KEY
  || 'PLACEHOLDER_REPLACE_AT_BUILD'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const CUE_API_ROOT = SUPABASE_URL

export function getCueApiKey(): string | undefined {
  return process.env.CUE_API_KEY
}
