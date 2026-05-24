import { createPublicClient, http } from 'viem';
import { celo } from 'viem/chains';

export const CHAIN = celo;

// Singleton read-only client — safe to import anywhere
export const publicClient = createPublicClient({
  chain: CHAIN,
  transport: http(),
});
