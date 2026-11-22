import AsyncStorage from '@react-native-async-storage/async-storage';
import { createCache } from './cache';

const baseUrl = process.env.EXPO_PUBLIC_RAWG_PROXY_URL?.replace(/\/$/, '');
const token = process.env.EXPO_PUBLIC_RAWG_PROXY_TOKEN;
const cache = createCache(AsyncStorage);
const pending = new Map();
const hour = 60 * 60 * 1000;

function failure(message, status) {
  return Object.assign(new Error(message), { status });
}

async function fetchProxy(path) {
  if (!baseUrl || !token) throw failure('Set the ShelfVault proxy URL and development token.', 400);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(baseUrl + path, {
        headers: { Authorization: 'Bearer ' + token }, signal: controller.signal,
      });
      if (response.ok) return await response.json();
      const messages = {
        401: 'Proxy access or RAWG credentials were rejected. Check the proxy configuration.',
        403: 'RAWG denied access. Check your key and plan.',
        404: 'This RAWG record is unavailable.',
        429: 'Request limit reached. Try again later.',
      };
      throw failure(messages[response.status] || 'RAWG is unavailable. Try again shortly.', response.status);
    } catch (error) {
      if (error.status && error.status < 500) throw error;
      if (attempt === 1) throw error.status ? error
        : failure('Could not reach the ShelfVault proxy. Check your connection.', 0);
    } finally {
      clearTimeout(timeout);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

function request(path, ttl, refresh) {
  if (pending.has(path)) return pending.get(path);
  const job = (async () => {
    const cached = await cache.get(path);
    if (!refresh && cached?.expires > Date.now()) return { data: cached.data, cached: true };
    try {
      const data = await fetchProxy(path);
      await cache.put(path, data, ttl);
      return { data };
    } catch (error) {
      if (!cached) throw error;
      return { data: cached.data, cached: true, warning: error.message };
    }
  })().finally(() => pending.delete(path));
  pending.set(path, job);
  return job;
}

const queryPath = (path, params) => {
  const pairs = Object.entries(params).filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
  return `${path}?${pairs.join('&')}`;
};

async function list(filters, page = 1, refresh = false) {
  const result = await request(queryPath('/games', { ...filters, page }), hour, refresh);
  const results = await Promise.all(result.data.results.map(async game => {
    const details = await cache.get('/games/' + game.providerId);
    return details?.data.explicitContent ? { ...game, explicitContent: true } : game;
  }));
  return { ...result, data: { ...result.data, results } };
}

export const artworkPath = (title, platform) =>
  queryPath('/artwork', { title, platform });

export const artworkCache = {
  get: async path => (await cache.get(path))?.data,
  resolve: async path => (await request(path, 24 * hour, false)).data,
};

export const rawg = {
  list,
  search: (search, filters = {}, page = 1, refresh = false) =>
    list({ search: search.trim(), ...filters }, page, refresh),
  details: (id, refresh = false) => request('/games/' + id, 24 * hour, refresh),
  platforms: (page, refresh = false) => request(queryPath('/platforms', { page }), 24 * hour, refresh),
};
