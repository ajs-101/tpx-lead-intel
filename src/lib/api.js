const PASS_KEY = 'tpx_lead_intel_passcode';

export const getPasscode = () => {
  try { return localStorage.getItem(PASS_KEY) || ''; } catch { return ''; }
};
export const setPasscode = (v) => {
  try { localStorage.setItem(PASS_KEY, v); } catch {}
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(payload, { retries = 3 } = {}) {
  let lastErr;
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-app-passcode': getPasscode() },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      if (res.ok) return data;
      const err = Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status });
      if (res.status === 401 || res.status === 400) throw err; // not retryable
      lastErr = err;
    } catch (e) {
      if (e.status === 401 || e.status === 400) throw e;
      lastErr = e;
    }
    // backoff: 2s, 5s, 10s (longer on rate limits)
    await sleep((lastErr?.status === 429 ? 6000 : 2000) * (i + 1));
  }
  throw lastErr;
}

export const analyzeLead = (row, offer) => post({ mode: 'lead', row, offer }).then((d) => d.result);
export const analyzeSegment = (rows, columns, offer) =>
  post({ mode: 'segment', rows, columns, offer }, { retries: 2 }).then((d) => d.result);
export const ping = () => post({ mode: 'ping' }, { retries: 0 });

// Run tasks with limited concurrency, calling onEach as each finishes.
export async function pool(items, worker, concurrency, shouldStop) {
  let next = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      if (shouldStop?.()) return;
      const i = next++;
      await worker(items[i], i);
    }
  });
  await Promise.all(runners);
}
