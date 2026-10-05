import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

/**
 * The ladder and admin routers pull in viem and the whole chain layer. They
 * are imported on their first request, not at boot: Supabase starts a fresh
 * isolate for nearly every request, so whatever is imported up front is paid
 * on every call, and a players/inventory request needs none of it.
 */
function lazy(prefix, load) {
  let router;
  return async (req, res, next) => {
    // Mounted without a path on purpose: app.use(path, …) would strip the
    // prefix, and these routers match on the full /api/... path.
    if (!req.path.startsWith(prefix)) return next();
    try {
      router ??= await load();
    } catch (err) {
      return next(err);
    }
    router(req, res, next);
  };
}

/**
 * Builds the API app. Two hosts run it:
 *
 *   - Node (index.js): a long-lived process, which also runs the chain indexer
 *     on a timer.
 *   - Supabase Edge Functions (supabase/functions/api): each isolate is
 *     short-lived, so nothing here may depend on in-process state surviving
 *     between requests. The indexer is driven by POST /api/indexer/sync instead.
 *
 * Every route already lives under /api, which is also the function's name, so
 * both hosts serve the same paths.
 */
export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  // ─── Ladder ──────────────────────────────────────────────────
  // Mounted below the existing gameplay routes. The ladder never trusts a
  // client-reported counter: it derives them from on-chain events and
  // receipt-verified purchases (see server/chain/).
  app.use(lazy('/api/ladder/', async () => {
    const { ladderRoutes } = await import('./routes/ladder.js');
    return ladderRoutes(supabase);
  }));
  app.use(lazy('/api/admin/', async () => {
    const { adminRoutes } = await import('./routes/admin.js');
    const { settleCashGrant } = await import('./ladder/service.js');
    return adminRoutes(supabase, { settleCashGrant });
  }));

  // ─── Chain indexer ───────────────────────────────────────────
  // Where no process can hold a timer (Supabase), a scheduler calls this to
  // keep chain_events current between ladder syncs. Guarded by CRON_SECRET:
  // a sweep costs RPC calls, so it is not something anyone may trigger.
  app.post('/api/indexer/sync', async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.get('x-cron-secret') !== secret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { syncChainEvents } = await import('./chain/indexer.js');
    try {
      res.json(await syncChainEvents(supabase, { force: req.query.force === '1' }));
    } catch (err) {
      console.error('[indexer]', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Players ─────────────────────────────────────────────────

  app.post('/api/players', async (req, res) => {
    const addr = req.body.wallet?.toLowerCase();
    if (!addr) return res.status(400).json({ error: 'wallet is required' });

    const { data: existing } = await supabase
      .from('players')
      .select('*')
      .eq('wallet_address', addr)
      .single();

    if (existing) {
      await supabase
        .from('players')
        .update({ last_seen: new Date().toISOString() })
        .eq('wallet_address', addr);
      return res.json(existing);
    }

    const { data, error } = await supabase
      .from('players')
      .insert({ wallet_address: addr })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  });

  app.patch('/api/players/:wallet/username', async (req, res) => {
    const addr = req.params.wallet.toLowerCase();
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'username is required' });

    const { error } = await supabase
      .from('players')
      .update({ username })
      .eq('wallet_address', addr);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ─── Inventory ───────────────────────────────────────────────

  const DEFAULT_INV = {
    free_bombs_left: 3,
    free_expands_left: 3,
    paid_bombs: 0,
    paid_expands: 0,
  };

  app.get('/api/inventory/:wallet', async (req, res) => {
    const addr = req.params.wallet.toLowerCase();

    const { data } = await supabase
      .from('player_inventory')
      .select('*')
      .eq('wallet_address', addr)
      .single();

    if (data) return res.json(data);

    // Ensure player row exists before creating inventory (foreign key)
    const { data: player } = await supabase
      .from('players')
      .select('wallet_address')
      .eq('wallet_address', addr)
      .single();

    if (!player) {
      await supabase.from('players').insert({ wallet_address: addr });
    }

    const { data: created, error } = await supabase
      .from('player_inventory')
      .insert({ wallet_address: addr, ...DEFAULT_INV })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json(created);
  });

  // Reports CONSUMPTION only. This used to take absolute values and write them
  // straight to the row, unauthenticated — one request minted unlimited
  // power-ups. Granting is now exclusively credit_inventory(), called by the
  // server after an on-chain payment or a ladder milestone.
  //
  // consume_inventory() clamps every field to LEAST(stored, requested) inside
  // the UPDATE, so a larger number is silently ignored rather than rejected:
  // a client that has drifted high cannot raise its balance, and one that has
  // drifted low still settles at the lower figure, which is the safe direction.
  // The authoritative row comes back so the client can reconcile against it.
  app.patch('/api/inventory/:wallet', async (req, res) => {
    const addr = req.params.wallet.toLowerCase();

    // Anything that is not a non-negative integer is treated as "not supplied"
    // rather than trusted — a NULL leaves that column untouched.
    const count = (v) =>
      Number.isInteger(v) && v >= 0 ? v : null;

    const { data, error } = await supabase.rpc('consume_inventory', {
      p_wallet:       addr,
      p_free_bombs:   count(req.body.free_bombs_left),
      p_free_expands: count(req.body.free_expands_left),
      p_paid_bombs:   count(req.body.paid_bombs),
      p_paid_expands: count(req.body.paid_expands),
    });

    if (error) return res.status(500).json({ error: error.message });

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return res.status(404).json({ error: 'no inventory for that wallet' });
    res.json(row);
  });

  // ─── Purchases ───────────────────────────────────────────────

  app.post('/api/purchases', async (req, res) => {
    const { wallet, txHash, itemType, packageIndex, token, amount } = req.body;
    if (!wallet || !txHash) return res.status(400).json({ error: 'wallet and txHash are required' });

    const addr = wallet.toLowerCase();
    const { data: player } = await supabase.from('players').select('wallet_address').eq('wallet_address', addr).single();
    if (!player) await supabase.from('players').insert({ wallet_address: addr });

    // Upsert keyed on tx_hash so client retries can never duplicate a purchase
    const { error } = await supabase
      .from('purchases')
      .upsert({
        wallet_address: addr,
        tx_hash: txHash,
        item_type: itemType,
        package_index: packageIndex,
        token,
        amount,
      }, { onConflict: 'tx_hash', ignoreDuplicates: true });

    if (error) return res.status(500).json({ error: error.message });

    // Verify and grant now rather than at the next ladder sync, so the items
    // are on the server before the player's next reload. The client has
    // already waited for the receipt, so it is normally found first time; if
    // not, the next ladder sync picks the purchase up.
    const { verifyPendingPurchases } = await import('./chain/purchases.js');
    const result = await verifyPendingPurchases(supabase, { wallet: addr })
      .catch(err => ({ error: err.message }));
    if (result.error) console.error('[purchases]', result.error);

    res.json({ ok: true });
  });

  app.get('/api/purchases/:wallet', async (req, res) => {
    const addr = req.params.wallet.toLowerCase();
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const { data, error } = await supabase
      .from('purchases')
      .select('*')
      .eq('wallet_address', addr)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? []);
  });

  // ─── Game Sessions ───────────────────────────────────────────

  app.post('/api/sessions', async (req, res) => {
    const { wallet, score, durationSeconds, merges, powerUpsUsed } = req.body;
    if (!wallet) return res.status(400).json({ error: 'wallet is required' });

    const addr = wallet.toLowerCase();
    const { data: player } = await supabase.from('players').select('wallet_address').eq('wallet_address', addr).single();
    if (!player) await supabase.from('players').insert({ wallet_address: addr });

    const { error } = await supabase
      .from('game_sessions')
      .insert({
        wallet_address: addr,
        score: score ?? 0,
        duration_seconds: durationSeconds,
        merges: merges ?? 0,
        power_ups_used: powerUpsUsed ?? {},
      });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  app.get('/api/sessions/:wallet', async (req, res) => {
    const addr = req.params.wallet.toLowerCase();
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const { data, error } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('wallet_address', addr)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? []);
  });

  // ─── Leaderboard ─────────────────────────────────────────────

  app.get('/api/leaderboard', async (req, res) => {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const { data, error } = await supabase
      .from('leaderboard_cache')
      .select('*')
      .order('score', { ascending: false })
      .limit(limit);

    if (error) return res.status(500).json({ error: error.message });
    res.json(data ?? []);
  });

  app.post('/api/leaderboard', async (req, res) => {
    const { wallet, username, score } = req.body;
    if (!wallet || score === undefined) return res.status(400).json({ error: 'wallet and score are required' });

    const { error } = await supabase
      .from('leaderboard_cache')
      .insert({
        wallet_address: wallet.toLowerCase(),
        username: username ?? null,
        score,
      });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
  });

  // ─── Health ──────────────────────────────────────────────────

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));

  return { app, supabase };
}
