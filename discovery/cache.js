const CACHE_KEY = 'shelfvault.expo.rawg-cache.v2';
const MAX_AGE = 14 * 24 * 60 * 60 * 1000;

function createCache(storage, { maxEntries = 100, maxChars = 500_000, now = Date.now, key: cacheKey = CACHE_KEY } = {}) {
  let queue = Promise.resolve();
  const loaded = Promise.resolve().then(() => storage.getItem(cacheKey)).then(raw => {
    const parsed = JSON.parse(raw || '[]');
    return new Map(Array.isArray(parsed) ? parsed : []);
  }).catch(() => new Map());

  return {
    async get(key) {
      const entries = await loaded;
      const entry = entries.get(key);
      return entry && now() - entry.saved < MAX_AGE ? entry : null;
    },
    put(key, data, ttl) {
      queue = queue.then(async () => {
        const entries = await loaded;
        const saved = now();
        for (const [id, entry] of entries) {
          if (!entry || saved - entry.saved >= MAX_AGE) entries.delete(id);
        }
        const entry = { data, saved, expires: saved + ttl };
        if (JSON.stringify([[key, entry]]).length > maxChars) return;
        entries.delete(key);
        entries.set(key, entry);
        let packed = JSON.stringify([...entries]);
        while (entries.size > maxEntries || packed.length > maxChars) {
          entries.delete(entries.keys().next().value);
          packed = JSON.stringify([...entries]);
        }
        await storage.setItem(cacheKey, packed);
      }).catch(() => {});
      return queue;
    },
  };
}

module.exports = { createCache, CACHE_KEY };
