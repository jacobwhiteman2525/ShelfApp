const http = require('node:http');
const { timingSafeEqual } = require('node:crypto');
const { normalizeGame, normalizePlatform } = require('../discovery/model');
const { discoveryIntent, permitsGame } = require('../discovery/contentPolicy');
const { createCoverLookup } = require('./cover-art');

const allowed = {
  page: /^[1-9]\d{0,3}$/,
  search: /^.{1,120}$/u,
  platforms: /^[1-9]\d{0,7}$/,
  ordering: /^(?:-added|-released|released|-rating|-metacritic)$/,
  dates: /^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/,
  intent: /^(safe|exact|explicit)$/,
};

function route(requestUrl) {
  const input = new URL(requestUrl, 'http://localhost');
  if (input.pathname === '/artwork') {
    const title = input.searchParams.get('title')?.trim();
    const platform = input.searchParams.get('platform')?.trim();
    if (!title || title.length > 240 || !platform || platform.length > 80 ||
        [...input.searchParams].length !== 2) return null;
    return { artwork: true, title, platform };
  }
  const gameList = input.pathname === '/games';
  const platforms = input.pathname === '/platforms';
  const details = /^\/games\/[1-9]\d{0,9}$/.test(input.pathname);
  if (!gameList && !platforms && !details) return null;
  const params = new URLSearchParams();
  for (const [key, value] of input.searchParams) {
    if (params.has(key) || (key !== 'page' && !gameList) || details ||
        !Object.hasOwn(allowed, key) || !allowed[key].test(value)) return null;
    params.set(key, value);
  }
  if (!details) params.set('page_size', platforms ? '40' : '20');
  const search = params.get('search');
  const requested = params.get('intent');
  const intent = requested === 'safe' || !requested ? 'safe'
    : discoveryIntent(search, requested === 'exact');
  params.delete('intent');
  if (intent === 'exact') params.set('search_exact', 'true');
  return { pathname: input.pathname, params, details, platforms, search, intent };
}

function createProxy({ key, token, fetchUpstream = fetch, coverKey, fetchArtwork }) {
  if (!key || !token || token.length < 24) throw Error('Set RAWG_API_KEY and a development token of at least 24 characters.');
  const expected = Buffer.from('Bearer ' + token);
  let active = 0;
  let requests = [];
  let cooldownUntil = 0;
  const coverLookup = createCoverLookup({ key: coverKey, fetchArtwork });

  return http.createServer(async (req, res) => {
    const send = (status, body, headers = {}) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
        ...headers,
      });
      res.end(JSON.stringify(body));
    };
    if (req.method !== 'GET') return send(405, { error: 'Method not allowed' }, { Allow: 'GET' });
    const supplied = Buffer.from(req.headers.authorization || '');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
      return send(401, { error: 'Proxy access denied' });
    }

    let endpoint;
    try {
      endpoint = route(req.url);
    } catch {
      return send(400, { error: 'Invalid request' });
    }
    if (!endpoint) return send(400, { error: 'Unsupported RAWG request' });

    const now = Date.now();
    requests = requests.filter(time => now - time < 60_000);
    if (active >= 4 || requests.length >= 60 || (!endpoint.artwork && now < cooldownUntil)) {
      const delay = Math.max(2, Math.ceil((cooldownUntil - now) / 1000),
        requests.length >= 60 ? Math.ceil((requests[0] + 60_000 - now) / 1000) : 0);
      return send(429, { error: 'Request limit reached' }, { 'Retry-After': String(delay) });
    }

    requests.push(now);
    active += 1;
    try {
      if (endpoint.artwork) {
        const artwork = await coverLookup(endpoint.title, endpoint.platform);
        return artwork ? send(200, artwork) : send(404, { error: 'Cover lookup unavailable' });
      }
      const upstream = new URL('https://api.rawg.io/api' + endpoint.pathname);
      upstream.search = endpoint.params.toString();
      upstream.searchParams.set('key', key);
      const response = await fetchUpstream(upstream, {
        redirect: 'error', signal: AbortSignal.timeout(6500),
      });
      if (!response.ok) {
        const status = [401, 403, 404, 429].includes(response.status) ? response.status : 502;
        if (status === 429) {
          const value = response.headers.get('retry-after');
          const delay = value && /^\d+$/.test(value)
            ? Number(value) : Math.ceil((Date.parse(value) - Date.now()) / 1000);
          const seconds = Math.min(86400, Math.max(1, Number.isFinite(delay) ? delay : 60));
          cooldownUntil = Date.now() + seconds * 1000;
          return send(429, { error: 'RAWG request limit reached' }, { 'Retry-After': String(seconds) });
        }
        return send(status, { error: 'RAWG request failed' });
      }
      const data = await response.json();
      if (endpoint.details) {
        const game = normalizeGame(data);
        return game ? send(200, game) : send(502, { error: 'Invalid RAWG game' });
      }
      if (!Array.isArray(data.results)) return send(502, { error: 'Invalid RAWG page' });
      const normalize = endpoint.platforms ? normalizePlatform : normalizeGame;
      const results = data.results.map(normalize).filter(Boolean);
      return send(200, {
        results: endpoint.platforms ? results : results.filter(game =>
          permitsGame(game, endpoint.search, endpoint.intent)),
        hasMore: Boolean(data.next),
      });
    } catch (error) {
      return send(error.name === 'TimeoutError' ? 504 : 502, { error: 'RAWG unavailable' });
    } finally {
      active -= 1;
    }
  });
}

if (require.main === module) {
  try {
    const server = createProxy({
      key: process.env.RAWG_API_KEY, token: process.env.RAWG_PROXY_TOKEN,
      coverKey: process.env.THEGAMESDB_API_KEY,
    });
    const host = process.env.RAWG_PROXY_HOST || '127.0.0.1';
    const port = Number(process.env.RAWG_PROXY_PORT || 8787);
    server.listen(port, host, () => console.log(`ShelfVault proxy listening on ${host}:${port}`));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { createProxy };
