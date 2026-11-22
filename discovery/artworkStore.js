const { frontCoverUrl } = require('./coverPolicy');

const lookupMisses = new Set([
  'no_matching_game', 'platform_mismatch', 'ambiguous_match', 'no_front_cover', 'image_url_rejected',
]);
const providerIssues = new Set(['provider_not_configured', 'provider_denied', 'provider_failed', 'rate_limited']);
const positiveTtl = 7 * 24 * 60 * 60 * 1000;
const negativeTtl = 5 * 60 * 1000;

function createArtworkStore(cache, fetchCover, {
  now = Date.now, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), spacing = 1500,
} = {}) {
  const negative = new Map();
  const pending = new Map();
  const storageKey = path => 'physical-front:v2:' + path;
  let queue = Promise.resolve();
  let nextStart = 0;
  let providerPause;

  async function cached(path, title, platform) {
    const entry = await cache.get(storageKey(path));
    return frontCoverUrl(entry?.data, title, platform) ? entry : null;
  }

  function resolve(path, title, platform) {
    if (pending.has(path)) return pending.get(path);
    if (pending.size >= 16) return Promise.resolve({ status: 'lookup_busy', retryAfterMs: 4000 });
    const job = (async () => {
      const entry = await cached(path, title, platform);
      if (entry?.expires > now()) return entry.data;
      const miss = negative.get(path);
      if (miss?.until > now()) return { ...miss.result, cachedNegative: true };
      const run = queue.then(async () => {
        if (providerPause?.until > now()) {
          return entry?.data || { ...providerPause.result, retryAfterMs: providerPause.until - now() };
        }
        const delay = nextStart - now();
        if (delay > 0) await wait(delay);
        nextStart = now() + spacing;
        let result;
        try {
          result = await fetchCover(path);
        } catch {
          result = { status: 'provider_failed', retryAfterMs: 30_000 };
        }
        if (result?.status === 'resolved') {
          if (frontCoverUrl(result, title, platform)) {
            await cache.put(storageKey(path), result, positiveTtl);
            return result;
          }
          result = { status: 'image_url_rejected' };
        }
        if (lookupMisses.has(result?.status)) {
          if (negative.size >= 100) negative.delete(negative.keys().next().value);
          negative.set(path, { until: now() + negativeTtl, result });
          return result;
        }
        if (!providerIssues.has(result?.status)) result = { status: 'provider_failed' };
        const retryAfterMs = Math.min(300_000, Math.max(2000, Number(result.retryAfterMs) || 30_000));
        providerPause = { until: now() + retryAfterMs, result: { ...result, retryAfterMs } };
        return entry?.data || providerPause.result;
      });
      queue = run.catch(() => {});
      return run;
    })().finally(() => pending.delete(path));
    pending.set(path, job);
    return job;
  }

  return { cached, resolve };
}

module.exports = { createArtworkStore };
