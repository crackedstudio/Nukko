# Nukko server

`app.js` builds the Express API. Two hosts run it:

- `index.js` — Node (`npm start`), which also runs the chain indexer on a timer.
- `supabase/functions/api/index.ts` — the `api` Supabase Edge Function in the
  gameplay project. Every route already lives under `/api`, the function's name,
  so the paths are the same on both.

Edge isolates are short-lived, so nothing may depend on in-process state lasting
between requests: admin nonces and sessions live in `admin_nonces` /
`admin_sessions` (migration 007), the indexer throttle reads
`indexer_state.updated_at`, and the indexer timer is replaced by
`POST /api/indexer/sync`, called every 10 minutes by
`.github/workflows/index-chain.yml` with the `x-cron-secret` header.

## Hosting on Supabase Edge Functions

```bash
# Run locally under Deno (reads server/.env), then hit http://localhost:8787/api/health
cd server && PORT=8787 deno run -A --config ../supabase/functions/api/deno.json ../supabase/functions/api/index.ts

# Schema: apply supabase/migrations/007_admin_auth.sql to the gameplay project first.

# Secrets. SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
supabase secrets set --project-ref kvgcsucroxqsszkadpjl \
  REWARDS_SUPABASE_URL=... REWARDS_SUPABASE_SERVICE_ROLE_KEY=... \
  CELO_RPC_URL=... CRON_SECRET=...
# Optional, only if set on the Node host: ADMIN_WALLETS, ADMIN_TOKEN,
# NUKKO_CONTRACT_ADDRESS, TREASURY_ADDRESS, TEST_CASH_ADDRESSES, INDEXER_*

# Deploy (JWT verification is off in supabase/config.toml — the browser calls it directly)
supabase functions deploy api --project-ref kvgcsucroxqsszkadpjl
```

Then point the frontend at it:
`VITE_API_URL=https://kvgcsucroxqsszkadpjl.supabase.co/functions/v1`, and add
`CRON_SECRET` as a GitHub repository secret for the indexer workflow.

The npm dependency versions for the function are pinned in
`supabase/functions/api/deno.json`; bump them there when `package.json` changes.
