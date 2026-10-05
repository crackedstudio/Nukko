import { createApp } from './app.js';
import { startIndexer } from './chain/indexer.js';

const { app, supabase } = createApp();

// ─── Start ───────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Nukko server running on :${PORT}`);
  // Keeps chain_events current so ladder counters are never stale. Each
  // sync is incremental and skips if one is already in flight.
  startIndexer(supabase);
});
