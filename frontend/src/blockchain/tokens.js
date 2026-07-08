import { parseUnits } from 'viem';

// Treasury wallet — receives all USDm/USDC/USDT time and power-up payments.
// Keep this aligned with Blokaz: MiniPay production stablecoin transfers are
// sensitive to the recipient identity, so client purchases must not drift per
// deploy environment.
export const TREASURY = '0x3E325B45F72dFCc3875f75b5933A5da183Ec4225';

// Celo mainnet stablecoins supported for purchases. Match Blokaz's checkout
// table: transfers use the token address only; MiniPay handles network fees.
export const STABLECOINS = {
  USDm: {
    key:         'USDm',
    symbol:      'USDm',
    label:       'USDm',
    address:     '0x765DE816845861e75A25fCA122bb6898B8B1282a',
    decimals:    18,
  },
  USDC: {
    key:         'USDC',
    symbol:      'USDC',
    label:       'USDC',
    address:     '0xcebA9300f2b948710d2653dD7B07f33A8B32118C',
    decimals:    6,
  },
  USDT: {
    key:         'USDT',
    symbol:      'USDT',
    label:       'USDT',
    address:     '0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e',
    decimals:    6,
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
