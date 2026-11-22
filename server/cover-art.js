const { normalizeGameText } = require('../discovery/model');
const { frontCoverUrl } = require('../discovery/coverPolicy');

const platformsByAlias = new Map([
  ['n64', 'nintendo 64'], ['nsw', 'nintendo switch'], ['switch', 'nintendo switch'],
  ['gamecube', 'nintendo gamecube'], ['wii', 'nintendo wii'], ['wii u', 'nintendo wii u'],
  ['ps4', 'playstation 4'], ['ps5', 'playstation 5'], ['ps3', 'playstation 3'],
  ['x360', 'xbox 360'], ['xb1', 'xbox one'], ['xbox series s x', 'xbox series x'],
]);

function titleKey(value) {
  return normalizeGameText(typeof value === 'string' ? value.replace(/[™®]/g, '') : '')
    .replace(/['’]/g, '').replace(/[‐‑–—]/g, '-')
    .replace(/[^\p{L}\p{N}+&]+/gu, ' ').replace(/\s*\+\s*/g, '+')
    .replace(/\s+/g, ' ').trim();
}

function platformKey(value) {
  const name = titleKey(value).replace(/^(sony|microsoft) /, '');
  return platformsByAlias.get(name) || name;
}

const aliases = [
  ['Grand Theft Auto V', 'Grand Theft Auto 5', 'GTA V', 'GTA 5'],
  ['The Witcher 3: Wild Hunt', 'Witcher 3: Wild Hunt'],
];

function titleVariants(title, platform) {
  const regional = platformKey(platform) === 'nintendo 64' ? [['Star Fox 64', 'Lylat Wars']] : [];
  const variants = [...aliases, ...regional].find(group => group.some(name => titleKey(name) === titleKey(title)));
  return (variants || []).filter(name => titleKey(name) !== titleKey(title));
}

function releaseMarkers(title) {
  return (titleKey(title).match(/\b(?:remaster(?:ed)?|remake|definitive|complete|ultimate|deluxe|collector\w*|anniversary|collection|compilation|bundle|hd|goty|game of the year|director\w* cut|(?:19|20)\d{2})\b|\d+\+\d+/g) || []).sort().join('|');
}

function scoreTitle(game, title, platform) {
  const key = titleKey(title);
  if (!key) return 0;
  if (titleKey(game.game_title) === key) return 3;
  if (titleVariants(title, platform).some(alias => titleKey(alias) === titleKey(game.game_title))) return 2;
  if (releaseMarkers(title) !== releaseMarkers(game.game_title)) return 0;
  return Array.isArray(game.alternates) && game.alternates.some(alias => titleKey(alias) === key) ? 1 : 0;
}

const unresolved = status => ({ status });
const assetPath = /^boxart\/front\/[\w.-]+\.(?:png|jpe?g|webp)$/i;

function selectFrontCover(payload, title, platformId, platform) {
  const games = payload?.data?.games;
  if (!Array.isArray(games)) return unresolved('provider_failed');
  if (payload.pages?.next) return unresolved('ambiguous_match');
  const scores = games.map(game => ({ game, score: scoreTitle(game, title, platform) }))
    .filter(({ score }) => score > 0);
  if (!scores.length) return unresolved('no_matching_game');
  const matching = scores.filter(({ game }) => Number(game.platform) === platformId);
  if (!matching.length) return unresolved('platform_mismatch');
  const highest = Math.max(...matching.map(({ score }) => score));
  const winners = matching.filter(({ score }) => score === highest);
  if (winners.length !== 1) return unresolved('ambiguous_match');

  const { game } = winners[0];
  const boxart = payload.include?.boxart;
  const images = boxart?.data?.[game.id];
  const fronts = Array.isArray(images) ? images.filter(image =>
    image?.type === 'boxart' && image?.side === 'front') : [];
  if (!fronts.length) return unresolved('no_front_cover');
  const base = boxart?.base_url?.original;
  for (const front of fronts) {
    if (typeof base !== 'string' || !assetPath.test(front.filename)) continue;
    const cover = {
      status: 'resolved',
      coverArtUrl: base.replace(/\/$/, '') + '/' + front.filename,
      coverArtSource: 'thegamesdb', coverArtKind: 'physical-front',
      coverArtTitle: title, coverArtPlatform: platform,
      providerGameId: game.id, providerPlatformId: platformId,
    };
    if (frontCoverUrl(cover, title, platform)) return cover;
  }
  return unresolved('image_url_rejected');
}

function createCoverLookup({ key, fetchArtwork = fetch, now = Date.now }) {
  let platforms;
  let paused;
  async function read(path, params = {}) {
    const url = new URL('/v1/' + path, 'https://api.thegamesdb.net');
    url.search = new URLSearchParams({ apikey: key, ...params });
    const response = await fetchArtwork(url, { redirect: 'error', signal: AbortSignal.timeout(3200) });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const providerStatus = response.status;
      const quota = providerStatus === 429 ||
        (providerStatus === 403 && payload?.remaining_monthly_allowance === 0);
      const status = quota ? 'rate_limited' : [401, 403].includes(providerStatus)
        ? 'provider_denied' : 'provider_failed';
      const seconds = Number(response.headers.get('retry-after'));
      const retryAfterMs = quota ? Math.min(300_000, Math.max(60_000, seconds * 1000 || 60_000)) : 30_000;
      const result = { status, providerStatus, retryAfterMs };
      if (status !== 'provider_failed') paused = { until: now() + retryAfterMs, result };
      throw Object.assign(new Error('TheGamesDB request failed'), { result });
    }
    if (!payload) throw Error('Invalid provider response');
    return payload;
  }

  return async (title, platform) => {
    if (!key?.trim()) return { status: 'provider_not_configured', retryAfterMs: 30_000 };
    if (paused && now() < paused.until) return {
      ...paused.result, retryAfterMs: paused.until - now(),
    };
    try {
      platforms ||= read('Platforms').then(payload => Object.values(payload.data.platforms))
        .catch(error => { platforms = undefined; throw error; });
      const names = (await platforms).filter(item =>
        platformKey(item.name) === platformKey(platform) ||
        (item.alias && platformKey(item.alias) === platformKey(platform)));
      if (names.length !== 1 || !Number.isSafeInteger(Number(names[0].id))) {
        return unresolved('platform_mismatch');
      }
      const id = Number(names[0].id);
      const alternate = titleVariants(title, platform)[0] || titleKey(title);
      const searchTerms = alternate !== normalizeGameText(title) ? [title, alternate] : [title];
      let result;
      for (const name of searchTerms) {
        const params = { name, include: 'boxart', fields: 'alternates', 'filter[platform]': String(id) };
        const payload = await read('Games/ByGameName', params);
        if (payload.pages?.next && Array.isArray(payload.data?.games)) {
          const next = await read('Games/ByGameName', { ...params, page: '2' });
          if (Array.isArray(next.data?.games)) {
            payload.data.games = [...new Map([...payload.data.games, ...next.data.games]
              .map(game => [game.id, game])).values()];
            const firstArt = payload.include?.boxart;
            const nextArt = next.include?.boxart;
            if (firstArt || nextArt) {
              payload.include = { boxart: {
                base_url: firstArt?.base_url || nextArt?.base_url,
                data: { ...firstArt?.data, ...nextArt?.data },
              } };
            }
            payload.pages = next.pages;
          }
        }
        result = selectFrontCover(payload, title, id, platform);
        if (result.status !== 'no_matching_game') break;
      }
      return { ...result, providerStatus: 200 };
    } catch (error) {
      return error.result || { status: 'provider_failed', retryAfterMs: 30_000 };
    }
  };
}

module.exports = { createCoverLookup, selectFrontCover };
