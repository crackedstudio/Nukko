// Backfill / reconcile the purchases table from on-chain treasury transfers.
//
// Fetches every incoming stablecoin transfer to the treasury addresses via
// Blockscout, then upserts them into Supabase keyed on tx_hash — rows that
// already exist are skipped, so this is safe to re-run any time purchases
// may have been missed by the client-side recorder.
//
// Usage: node scripts/backfill-purchases.js [--dry-run]

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

// Only the dedicated Nukko treasury is reconciled. The legacy recipient
// (0x3E325B45F72dFCc3875f75b5933A5da183Ec4225) is shared with Blokaz, so its
// transfers can't be attributed to Nukko — the brief Jul 8 window when Nukko
// still paid into it is covered by client-side recording.
const TREASURIES = [
  '0xAF3B714fDDa5A3b4311f78ccfe0873A990819A35',
];

// Celo mainnet stablecoins accepted for purchases (must match frontend tokens.js)
const STABLECOINS = {
  '0x765de816845861e75a25fca122bb6898b8b1282a': { symbol: 'USDm', decimals: 18 },
  '0xceba9300f2b948710d2653dd7b07f33a8b32118c': { symbol: 'USDC', decimals: 6 },
  '0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e': { symbol: 'USDT', decimals: 6 },
};

// Amount → item mapping. Purchase type can't be fully recovered from the
// chain (a 0.10 transfer is either the 15s time package or a single
// power-up), so map to the time packages first and mark anything else
// with package_index -1 (= unrecognized amount / legacy pricing).
const TIME_PACKAGES = { '0.1': 0, '0.2': 1, '0.35': 2 };

function classify(amount) {
  const idx = TIME_PACKAGES[amount];
  if (idx !== undefined) return { itemType: 'time', packageIndex: idx };
  return { itemType: 'time', packageIndex: -1 };
}

const BLOCKSCOUT = 'https://celo.blockscout.com/api/v2';
const dryRun = process.argv.includes('--dry-run');

// The treasury is shared with Blokaz, so transfers before live client-side
// recording began (Jul 8 2026) are a mix of both apps and must never be
// imported as Nukko purchases — that history was purged on Jul 8.
const SINCE = '2026-07-08T00:00:00Z';

async function fetchTransfers(treasury) {
  const transfers = [];
  let params = '';
  for (let page = 0; page < 50; page++) {
    const res = await fetch(
      `${BLOCKSCOUT}/addresses/${treasury}/token-transfers?type=ERC-20&filter=to${params}`,
    );
    if (!res.ok) throw new Error(`Blockscout ${res.status} for ${treasury}`);
    const body = await res.json();

    let reachedCutoff = false;
    for (const item of body.items ?? []) {
      if (item.timestamp < SINCE) { reachedCutoff = true; break; } // newest-first
      const token = STABLECOINS[item.token.address_hash.toLowerCase()];
      if (!token) continue; // ignore random/unsupported tokens
      const amount = (
        Number(item.total.value) / 10 ** Number(item.total.decimals)
      ).toString();
      transfers.push({
        wallet: item.from.hash.toLowerCase(),
        txHash: item.transaction_hash,
        token: token.symbol,
        amount,
        timestamp: item.timestamp,
      });
    }

    if (reachedCutoff || !body.next_page_params) break;
    params = '&' + new URLSearchParams(body.next_page_params).toString();
  }
  return transfers;
}

async function main() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const transfers = [];
  for (const treasury of TREASURIES) {
    const t = await fetchTransfers(treasury);
    console.log(`${treasury}: ${t.length} incoming stablecoin transfers`);
    transfers.push(...t);
  }
  if (transfers.length === 0) return console.log('Nothing to backfill.');

  const rows = transfers.map((t) => {
    const { itemType, packageIndex } = classify(t.amount);
    return {
      wallet_address: t.wallet,
      tx_hash: t.txHash,
      item_type: itemType,
      package_index: packageIndex,
      token: t.token,
      amount: t.amount,
      created_at: t.timestamp,
    };
  });

  if (dryRun) {
    console.table(rows.map(({ tx_hash, ...r }) => ({ tx: tx_hash.slice(0, 12), ...r })));
    return console.log(`Dry run — would upsert ${rows.length} rows.`);
  }

  // purchases.wallet_address references players — ensure player rows exist
  const wallets = [...new Set(rows.map((r) => r.wallet_address))].map(
    (wallet_address) => ({ wallet_address }),
  );
  const { error: playersErr } = await supabase
    .from('players')
    .upsert(wallets, { onConflict: 'wallet_address', ignoreDuplicates: true });
  if (playersErr) throw new Error(`players upsert failed: ${playersErr.message}`);

  const { error, count } = await supabase
    .from('purchases')
    .upsert(rows, { onConflict: 'tx_hash', ignoreDuplicates: true, count: 'exact' });
  if (error) throw new Error(`purchases upsert failed: ${error.message}`);

  console.log(`Done. ${rows.length} on-chain purchases processed (${count ?? '?'} written).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
