-- Run this once against your Vercel Postgres database before first use.

CREATE TABLE IF NOT EXISTS links (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  destination_url TEXT NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  -- QR dot/corner shapes + colors as a single JSON blob (see lib/qrStyles.ts).
  -- NULL means render the plain default look (all links created before this
  -- column existed, or if style parsing ever fails).
  style JSONB
);

CREATE TABLE IF NOT EXISTS scans (
  id SERIAL PRIMARY KEY,
  link_id INTEGER REFERENCES links(id) ON DELETE CASCADE,
  click_id TEXT UNIQUE NOT NULL,
  scanned_at TIMESTAMPTZ DEFAULT now(),
  user_agent TEXT,
  referrer TEXT,
  country TEXT
);

CREATE TABLE IF NOT EXISTS actions (
  id SERIAL PRIMARY KEY,
  click_id TEXT REFERENCES scans(click_id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scans_link_id ON scans(link_id);
CREATE INDEX IF NOT EXISTS idx_actions_click_id ON actions(click_id);
