// Grant every verified power-up purchase that has not been granted yet.
//
// From 2026-09-05 until migration 008, a verified purchase was never added to
// player_inventory, so players lost what they bought on their next reload.
// The server now grants on verification; this catches up the purchases made
// before that. It goes through credit_purchase(), the same once-only path the
// server uses, so it is safe to re-run.
//
// Usage: node scripts/credit-purchases.js [--dry-run]

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { POWERUP_PACKAGES } from '../chain/client.js';
import { creditVerifiedPurchases } from '../chain/purchases.js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const dryRun = process.argv.includes('--dry-run');

const { data: rows, error } = await supabase
  .from('purchases')
  .select('wallet_address, item_type, package_index, verified_amount')
  .not('verified_at', 'is', null)
  .is('credited_at', null)
  .in('item_type', ['bomb', 'expand'])
  .limit(1000);
if (error) throw new Error(error.message);

const perWallet = new Map();
let bombs = 0, expands = 0, uncovered = 0;
for (const r of rows) {
  const pkg = POWERUP_PACKAGES[r.package_index];
  if (!pkg || Number(r.verified_amount) + 1e-9 < pkg.priceUSD) { uncovered++; continue; }
  const w = perWallet.get(r.wallet_address) ?? { bombs: 0, expands: 0 };
  if (r.item_type === 'bomb') { w.bombs += pkg.qty; bombs += pkg.qty; }
  else { w.expands += pkg.qty; expands += pkg.qty; }
  perWallet.set(r.wallet_address, w);
}

console.log(`${rows.length} uncredited verified purchases → ${bombs} bombs, ${expands} expands across ${perWallet.size} wallets`);
if (uncovered) console.log(`${uncovered} not covered by their verified amount — left uncredited`);
for (const [wallet, w] of perWallet) console.log(`  ${wallet}  +${w.bombs} bombs  +${w.expands} expands`);

if (dryRun) {
  console.log('dry run — nothing granted');
} else {
  const result = await creditVerifiedPurchases(supabase, { limit: 1000 });
  console.log('granted:', JSON.stringify(result));
}
