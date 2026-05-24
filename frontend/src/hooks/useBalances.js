import { useState, useEffect, useCallback } from 'react';
import { publicClient }                      from '../blockchain/config.js';
import { STABLECOINS, ERC20_ABI }            from '../blockchain/tokens.js';

const ZERO_BALANCES = Object.fromEntries(
  Object.keys(STABLECOINS).map((k) => [k, 0n]),
);

export function useBalances(address) {
  const [balances, setBalances] = useState(ZERO_BALANCES);
  const [loading,  setLoading]  = useState(false);

  const refresh = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    try {
      const entries = await Promise.all(
        Object.entries(STABLECOINS).map(async ([key, token]) => {
          const val = await publicClient.readContract({
            address:      token.address,
            abi:          ERC20_ABI,
            functionName: 'balanceOf',
            args:         [address],
          });
          return [key, val];
        }),
      );
      setBalances(Object.fromEntries(entries));
    } catch {}
    finally { setLoading(false); }
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);

  // Token whose USD-equivalent balance is highest — matches MiniPay reference
  const richestToken = Object.entries(STABLECOINS)
    .sort(([aKey, aToken], [bKey, bToken]) => {
      const aUsd = Number(balances[aKey]) / 10 ** aToken.decimals;
      const bUsd = Number(balances[bKey]) / 10 ** bToken.decimals;
      return bUsd - aUsd;
    })[0]?.[0] ?? 'USDm';

  return { balances, loading, richestToken, refresh };
}
