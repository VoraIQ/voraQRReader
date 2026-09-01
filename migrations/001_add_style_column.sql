-- Run this by hand in the Neon SQL editor (or `psql "$DATABASE_URL" -f
-- migrations/001_add_style_column.sql`) against a database that already ran
-- the original schema.sql. Safe to re-run.

ALTER TABLE links ADD COLUMN IF NOT EXISTS style JSONB;
