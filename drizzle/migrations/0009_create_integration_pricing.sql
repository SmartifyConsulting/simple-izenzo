-- One row per provider: the most recently scraped cost summary for that provider's public
-- pricing page, refreshed weekly (see the "pricing-refresh" cron endpoint) or on demand from
-- Admin → Integrations. Never trusted silently — `reviewed` stays false until an admin confirms
-- the AI-extracted summary actually matches the page it was read from.
CREATE TABLE public.integration_pricing (
  provider TEXT PRIMARY KEY,
  source_url TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'ok', -- 'ok' | 'error'
  error TEXT,
  extracted_summary TEXT, -- AI's best-guess cost description, e.g. "$1.50 per verification (Standard plan)"
  raw_excerpt TEXT, -- trimmed page text the summary was extracted from, for an admin to check against
  reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Server routes always use the service-role client (same pattern as integration_credentials) —
-- RLS is enabled with no policies so a client-side/anon key can never read or write this table.
ALTER TABLE public.integration_pricing ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.integration_pricing TO service_role;
