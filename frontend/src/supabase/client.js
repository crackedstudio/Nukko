const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const RETRIES     = 3;
const RETRY_DELAY = 3000; // ms — long enough to ride out a Render cold start

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function api(path, options = {}) {
  const isWrite = options.method && options.method !== 'GET';
  let lastErr;

  for (let attempt = 0; attempt <= (isWrite ? RETRIES : 0); attempt++) {
    try {
      const res = await fetch(`${API_URL}${path}`, {
        headers: { 'Content-Type': 'application/json', ...options.headers },
        // keepalive lets small write requests finish even if the page
        // navigates away (e.g. game-over screen change mid-request)
        keepalive: isWrite,
        ...options,
      });
      const data = await res.json();
      if (!res.ok) {
        // Retry server errors (cold start / transient); client errors are final
        if (res.status >= 500 && attempt < RETRIES && isWrite) {
          lastErr = new Error(data.error || `API error ${res.status}`);
          await sleep(RETRY_DELAY * (attempt + 1));
          continue;
        }
        throw new Error(data.error || `API error ${res.status}`);
      }
      return data;
    } catch (err) {
      lastErr = err;
      if (!isWrite || attempt >= RETRIES) throw err;
      await sleep(RETRY_DELAY * (attempt + 1));
    }
  }
  throw lastErr;
}
