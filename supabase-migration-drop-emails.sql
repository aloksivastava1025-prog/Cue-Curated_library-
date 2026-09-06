-- ============================================================
-- Cue — drop-notification email system
-- ============================================================
-- Backs the "Send drop email" admin flow. Emails free-tier signed-
-- up users about new components / big features to nudge Cue+
-- conversion. Cue+ members are excluded (they've already paid).
--
-- Two tables:
--   user_email_preferences   — per-user opt-out state + unique
--                              unsubscribe token so one-click
--                              unsubscribe works without login
--   email_send_log           — audit trail so we can (a) show
--                              admin how many landed, (b) diagnose
--                              deliverability issues, (c) not
--                              re-send the same drop email twice
--                              if the admin clicks Send twice.
-- ============================================================

-- ---- user_email_preferences ----
CREATE TABLE IF NOT EXISTS public.user_email_preferences (
  user_id             text PRIMARY KEY,
  email               text NOT NULL,
  unsubscribed        boolean NOT NULL DEFAULT false,
  unsubscribed_at     timestamptz,
  unsubscribe_token   text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uep_token
  ON public.user_email_preferences(unsubscribe_token);
CREATE INDEX IF NOT EXISTS idx_uep_email
  ON public.user_email_preferences(lower(email));

ALTER TABLE public.user_email_preferences ENABLE ROW LEVEL SECURITY;

-- Public read by token (unsubscribe endpoint needs to look up by
-- token without any auth) — safe because tokens are random 128-bit.
CREATE POLICY "cue: public read prefs by token"
  ON public.user_email_preferences
  FOR SELECT
  USING (true);

-- Writes only via service-role.
CREATE POLICY "cue: service-role write prefs"
  ON public.user_email_preferences
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT SELECT ON public.user_email_preferences TO anon, authenticated;
GRANT ALL    ON public.user_email_preferences TO service_role;

-- ---- email_send_log ----
CREATE TABLE IF NOT EXISTS public.email_send_log (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_key   text NOT NULL,          -- admin-supplied slug e.g. 'drop-2026-09-12'
  user_id        text,
  email          text NOT NULL,
  subject        text NOT NULL,
  resend_id      text,                   -- returned by Resend on success
  status         text NOT NULL,          -- 'sent' | 'failed' | 'skipped_unsubscribed'
  error          text,
  sent_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_esl_campaign
  ON public.email_send_log(campaign_key, sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_esl_email
  ON public.email_send_log(lower(email), sent_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_esl_dedupe
  ON public.email_send_log(campaign_key, lower(email));

ALTER TABLE public.email_send_log ENABLE ROW LEVEL SECURITY;

-- Reads/writes only via service-role — admin reads audit through
-- an authenticated edge fn if we ever add that surface.
CREATE POLICY "cue: service-role log access"
  ON public.email_send_log
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

GRANT ALL ON public.email_send_log TO service_role;
