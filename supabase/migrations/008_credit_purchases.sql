-- ============================================================
-- Nukko — credit shop purchases to inventory on the server
--
-- TARGET: this game's GAMEPLAY Supabase project (SUPABASE_URL).
--
-- Since 004 the client can only ever lower its inventory, and granting was
-- meant to be the server's job once a payment is verified. But verification
-- only stamped the purchase; nothing granted the items. Every power-up bought
-- since then showed up on the device and vanished on the next reload.
--
-- credited_at marks a purchase whose items are in player_inventory, so each
-- purchase is granted exactly once however many times verification runs.
-- ============================================================

ALTER TABLE purchases ADD COLUMN IF NOT EXISTS credited_at TIMESTAMPTZ;

-- Before 004 shipped, the client wrote absolute inventory values, so those
-- purchases were already granted by the client itself. Mark them, or the
-- server would grant them a second time. No purchase was made between
-- 2026-09-04 12:12 and 2026-09-06 08:32 UTC, so the cutoff is unambiguous.
UPDATE purchases
   SET credited_at = created_at
 WHERE credited_at IS NULL
   AND created_at < '2026-09-05T08:59:09Z';

-- Time packages are spent on the run they were bought in; there is nothing
-- to hold in inventory.
UPDATE purchases
   SET credited_at = COALESCE(verified_at, created_at)
 WHERE credited_at IS NULL
   AND item_type = 'time';

-- ─── Grant one verified purchase, once ──────────────────────
-- The claim and the grant are one statement-level transaction: a purchase is
-- marked credited if and only if its items were added. Returns false when the
-- purchase is unverified or was already credited.
CREATE OR REPLACE FUNCTION credit_purchase(p_id UUID, p_bombs INTEGER, p_expands INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql AS $$
DECLARE
  v_wallet TEXT;
BEGIN
  UPDATE purchases
     SET credited_at = NOW()
   WHERE id = p_id
     AND credited_at IS NULL
     AND verified_at IS NOT NULL
  RETURNING wallet_address INTO v_wallet;

  IF v_wallet IS NULL THEN
    RETURN FALSE;
  END IF;

  PERFORM credit_inventory(v_wallet, p_bombs, p_expands);
  RETURN TRUE;
END;
$$;

CREATE INDEX IF NOT EXISTS purchases_uncredited_idx
  ON purchases (wallet_address)
  WHERE credited_at IS NULL AND verified_at IS NOT NULL;

-- ─── Server only ─────────────────────────────────────────────
-- Functions in public are executable by anon and authenticated by default,
-- which would let anyone holding the project's public key mint power-ups.
-- Only the server (service role) may grant.
REVOKE EXECUTE ON FUNCTION credit_purchase(UUID, INTEGER, INTEGER)   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION credit_inventory(TEXT, INTEGER, INTEGER)  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION credit_purchase(UUID, INTEGER, INTEGER)   TO service_role;
GRANT  EXECUTE ON FUNCTION credit_inventory(TEXT, INTEGER, INTEGER)  TO service_role;
