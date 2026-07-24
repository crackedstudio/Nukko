import { concat } from 'viem';
import { toDataSuffix } from '@celo/attribution-tags';

// ─── Celo attribution tag (ERC-8021) ─────────────────────────────────────────
//
// Nukko's issued attribution code. It's appended as a trailing suffix to a
// transaction's calldata so on-chain activity from this app is credited to us.
//
// Why this is safe: the EVM discards trailing calldata bytes, so the suffix is
// invisible to the contract being called — it never changes what a transaction
// does or costs. It only marks the tx as having come through Nukko.
//
// IMPORTANT: this is an *issued* code and must be used verbatim. Do NOT swap it
// for codeFromHostname(location.hostname) — that derives a different value that
// is never credited to Nukko on the attribution dashboard.
const NUKKO_ATTRIBUTION_CODE = 'celo_da6hbgzq';

// Encoded once — the code is a compile-time constant.
export const ATTRIBUTION_SUFFIX = toDataSuffix(NUKKO_ATTRIBUTION_CODE);

// Append the attribution suffix to encoded calldata. Passing empty/undefined
// data (a plain value transfer) returns the bare suffix.
export function withAttribution(data) {
  return data && data !== '0x' ? concat([data, ATTRIBUTION_SUFFIX]) : ATTRIBUTION_SUFFIX;
}
