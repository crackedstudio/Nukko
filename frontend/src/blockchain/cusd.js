import { parseUnits } from 'viem';
import { IS_TESTNET } from './config.js';

export const CUSD_ADDRESS = IS_TESTNET
  ? '0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1'
  : '0x765DE816845861e75A25fCA122bb6898B8B1282a';

export const TREASURY =
  import.meta.env.VITE_TREASURY_ADDRESS ||
  '0x0000000000000000000000000000000000000000';

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

export const TIME_PACKAGES = [
  { label: 'Quick Boost',    seconds: 15, priceUSD: '0.10', priceWei: parseUnits('0.10', 18) },
  { label: 'Standard Boost', seconds: 30, priceUSD: '0.20', priceWei: parseUnits('0.20', 18) },
  { label: 'Big Boost',      seconds: 60, priceUSD: '0.35', priceWei: parseUnits('0.35', 18) },
];
