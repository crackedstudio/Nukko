-- ============================================================
-- Nukko — admin sign-in state in the database
--
-- TARGET: this game's GAMEPLAY Supabase project (SUPABASE_URL).
--
-- The admin nonce and session used to live in the server's memory. That held
-- on one long-lived Node process; on Supabase Edge Functions each request may
-- land on a different isolate, so a nonce issued by one was unknown to the one
-- verifying it. Both now live here, read and written by the server only.
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_nonces (
  nonce       TEXT PRIMARY KEY,
  expires_at  TIMESTAMPTZ NOT NULL
);

-- Only a SHA-256 of the bearer token is stored, so a read of this table does
-- not hand out a working admin session.
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash  TEXT PRIMARY KEY,
  address     TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_nonces_expires_idx   ON admin_nonces (expires_at);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions (expires_at);

-- Enabled with NO policies on purpose: the browser must never read or mint
-- admin sessions. The service-role key bypasses RLS.
ALTER TABLE admin_nonces   ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
