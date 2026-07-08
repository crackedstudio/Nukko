import { parseUnits } from 'viem';

// Treasury wallet — receives all cUSD/USDC/USDT time-purchase payments
export const TREASURY = import.meta.env.VITE_TREASURY_ADDRESS;

// Celo mainnet stablecoins supported for time purchases.
// feeCurrency is the CIP-64 fee token for MiniPay's gas abstraction — USDm
// uses the token itself, USDC/USDT need their adapter address (passing the
// token address as feeCurrency makes the tx fail).
export const STABLECOINS = {
  USDm: {
    key:         'USDm',
    symbol:      'USDm',
    label:       'USDm',
    address:     '0x765DE816845861e75A25fCA122bb6898B8B1282a',
    decimals:    18,
    feeCurrency: '0x765DE816845861e75A25fCA122bb6898B8B1282a',
  },
  USDC: {
    key:         'USDC',
    symbol:      'USDC',
    label:       'USDC',
    address:     '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    decimals:    6,
    feeCurrency: '0x2F25deB3848C207fc8E0c34035B3Ba7fC157602B',
  },
  USDT: {
    key:         'USDT',
    symbol:      'USDT',
    label:       'USDT',
    address:     '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
    decimals:    6,
    feeCurrency: '0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72',
  },
};

export const STABLECOIN_KEYS = Object.keys(STABLECOINS);

export const ERC20_ABI = [
  {
    name: 'transfer',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to',     type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
];

// Time packages — priceUSD is a string; convert with the chosen token's decimals at purchase time
export const TIME_PACKAGES = [
  { label: 'Quick Boost',    seconds: 15, priceUSD: '0.10' },
  { label: 'Standard Boost', seconds: 30, priceUSD: '0.20' },
  { label: 'Big Boost',      seconds: 60, priceUSD: '0.35' },
];

export const POWERUP_PACKAGES = [
  { qty: 1,  priceUSD: '0.10' },
  { qty: 5,  priceUSD: '0.40' },
  { qty: 10, priceUSD: '0.90' },
];

export function priceWei(priceUSD, decimals) {
  return parseUnits(priceUSD, decimals);
}
