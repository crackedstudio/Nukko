-- ============================================================
-- Nukko / Fruitopia — Supabase schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ─── Players ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS players (
  wallet_address TEXT PRIMARY KEY,
  username       TEXT UNIQUE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  last_seen      TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Game sessions ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS game_sessions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address   TEXT NOT NULL REFERENCES players(wallet_address),
  score            INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER,
  merges           INTEGER DEFAULT 0,
  power_ups_used   JSONB DEFAULT '{}',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Purchases (time, bombs, expands) ────────────────────────
CREATE TABLE IF NOT EXISTS purchases (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES players(wallet_address),
  tx_hash        TEXT NOT NULL UNIQUE,
  item_type      TEXT NOT NULL CHECK (item_type IN ('time', 'bomb', 'expand')),
  package_index  INTEGER NOT NULL,
  token          TEXT NOT NULL,
  amount         TEXT NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Player inventory (replaces localStorage) ───────────────
CREATE TABLE IF NOT EXISTS player_inventory (
  wallet_address  TEXT PRIMARY KEY REFERENCES players(wallet_address),
  free_bombs_left   INTEGER DEFAULT 3,
  free_expands_left INTEGER DEFAULT 3,
  paid_bombs        INTEGER DEFAULT 0,
  paid_expands      INTEGER DEFAULT 0,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Leaderboard cache (fast reads, mirrors on-chain) ────────
CREATE TABLE IF NOT EXISTS leaderboard_cache (
  id             SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  username       TEXT,
  score          INTEGER NOT NULL,
  recorded_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sessions_wallet    ON game_sessions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_sessions_score     ON game_sessions(score DESC);
CREATE INDEX IF NOT EXISTS idx_purchases_wallet   ON purchases(wallet_address);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score  ON leaderboard_cache(score DESC);

-- ─── Row Level Security ──────────────────────────────────────
ALTER TABLE players           ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_inventory  ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;

-- Players
CREATE POLICY "Anyone can read players"  ON players FOR SELECT USING (true);
CREATE POLICY "Anyone can create player" ON players FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update player" ON players FOR UPDATE USING (true);

-- Game sessions
CREATE POLICY "Anyone can read sessions"  ON game_sessions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert session" ON game_sessions FOR INSERT WITH CHECK (true);

-- Purchases
CREATE POLICY "Anyone can read purchases"  ON purchases FOR SELECT USING (true);
CREATE POLICY "Anyone can insert purchase" ON purchases FOR INSERT WITH CHECK (true);

-- Inventory
CREATE POLICY "Anyone can read inventory"  ON player_inventory FOR SELECT USING (true);
CREATE POLICY "Anyone can create inventory" ON player_inventory FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update inventory" ON player_inventory FOR UPDATE USING (true);

-- Leaderboard
CREATE POLICY "Anyone can read leaderboard"  ON leaderboard_cache FOR SELECT USING (true);
CREATE POLICY "Anyone can insert leaderboard" ON leaderboard_cache FOR INSERT WITH CHECK (true);
