export const CONTRACT_ADDRESS =
  import.meta.env.VITE_CONTRACT_ADDRESS ||
  '0x0000000000000000000000000000000000000000';

// ABI matches Nukko.sol exactly — UUPS upgradeable, MAX_LEADERBOARD=50
export const CONTRACT_ABI = [
  // ── Write ──────────────────────────────────────────────────────────────────
  {
    name: 'setUsername',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_username', type: 'string' }],
    outputs: [],
  },
  {
    name: 'startGame',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    // Only updates leaderboard when _score > personalBest (new record)
    name: 'submitScore',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_score', type: 'uint256' }],
    outputs: [],
  },
  {
    // onlyOwner — remove a cheating entry
    name: 'removeLeaderboardEntry',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: '_player', type: 'address' }],
    outputs: [],
  },
  // ── Read ───────────────────────────────────────────────────────────────────
  {
    name: 'getLeaderboard',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        components: [
          { name: 'player',    type: 'address' },
          { name: 'username',  type: 'string'  },
          { name: 'score',     type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },
    ],
  },
  {
    name: 'leaderboardCount',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    name: 'getProfile',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_player', type: 'address' }],
    outputs: [
      { name: 'username',     type: 'string'  },
      { name: 'personalBest', type: 'uint256' },
      { name: 'gamesPlayed',  type: 'uint256' },
      { name: 'sessionOpen',  type: 'bool'    },
    ],
  },
  {
    name: 'isUsernameAvailable',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: '_username', type: 'string' }],
    outputs: [{ name: '', type: 'bool' }],
  },
  // ── Constants (public) ─────────────────────────────────────────────────────
  {
    name: 'MAX_LEADERBOARD',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
  },
  // ── Events ─────────────────────────────────────────────────────────────────
  {
    name: 'UsernameSet',
    type: 'event',
    inputs: [
      { name: 'player',   type: 'address', indexed: true  },
      { name: 'username', type: 'string',  indexed: false },
    ],
  },
  {
    name: 'GameStarted',
    type: 'event',
    inputs: [
      { name: 'player',           type: 'address', indexed: true  },
      { name: 'totalGamesPlayed', type: 'uint256', indexed: false },
    ],
  },
  {
    // newRecord = true means personalBest was updated AND leaderboard was tried
    name: 'ScoreSubmitted',
    type: 'event',
    inputs: [
      { name: 'player',    type: 'address', indexed: true  },
      { name: 'score',     type: 'uint256', indexed: false },
      { name: 'newRecord', type: 'bool',    indexed: false },
    ],
  },
  {
    // rank is uint256 — matches contract exactly
    name: 'LeaderboardUpdated',
    type: 'event',
    inputs: [
      { name: 'player',   type: 'address', indexed: true  },
      { name: 'username', type: 'string',  indexed: false },
      { name: 'score',    type: 'uint256', indexed: false },
      { name: 'rank',     type: 'uint256', indexed: false },
    ],
  },
  {
    name: 'LeaderboardEntryRemoved',
    type: 'event',
    inputs: [
      { name: 'player',    type: 'address', indexed: true },
      { name: 'removedBy', type: 'address', indexed: true },
    ],
  },
];
