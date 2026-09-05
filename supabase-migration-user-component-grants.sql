-- ============================================================
-- Cue — per-user, per-component unlock grants
-- ============================================================
-- Backs the "Request this component — $20" flow. Buyers who don't
-- want the full Cue+ subscription pay for a single component; a
-- row here unlocks JUST that component for JUST that user.
--
-- Source of truth for grants:
--   • dodo-webhook edge function (auto, on payment.succeeded)
--   • admin-grant-component edge function (manual safety net)
--
-- Reads are open — matches current prompt_contents policy where
-- premium content is publicly readable pending the Clerk→Supabase
-- JWT bridge. Once the bridge lands, tighten SELECT to auth.jwt()
-- ->> 'sub' = user_id.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.user_component_grants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL,
  component_id    text NOT NULL,
  granted_at      timestamptz NOT NULL DEFAULT now(),
  granted_via     text NOT NULL DEFAULT 'dodo',   -- 'dodo' | 'manual'
  dodo_payment_id text,
  amount_usd      numeric(10,2),
  notes           text,
  UNIQUE (user_id, component_id)
);

CREATE INDEX IF NOT EXISTS idx_ucg_user
  ON public.user_component_grants(user_id);
CREATE INDEX IF NOT EXISTS idx_ucg_component
  ON public.user_component_grants(component_id);
CREATE INDEX IF NOT EXISTS idx_ucg_payment
  ON public.user_component_grants(dodo_payment_id)
  WHERE dodo_payment_id IS NOT NULL;

ALTER TABLE public.user_component_grants ENABLE ROW LEVEL SECURITY;

-- Public SELECT — clients read their own grants by filtering
-- WHERE user_id = <clerk id>. Interim posture until JWT bridge.
CREATE POLICY "cue: public read grants"
  ON public.user_component_grants
  FOR SELECT
  USING (true);

-- Writes only via service-role (Dodo webhook + admin edge fns).
CREATE POLICY "cue: service-role write grants"
  ON public.user_component_grants
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Grant explicit privileges (RLS still enforces).
GRANT SELECT ON public.user_component_grants TO anon, authenticated;
GRANT ALL    ON public.user_component_grants TO service_role;
